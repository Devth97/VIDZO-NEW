/**
 * Server-side media verification from actual bytes. Never trusts the client's declared type, size or duration.
 * Video: parses ISO BMFF (MP4/MOV) box headers via ranged reads — ftyp brand, moov/mvhd duration and each
 * track's handler + sample-entry codec — without loading media data. Full decode checks (corrupt frames,
 * missing frames) belong to the FFmpeg media worker before analysis/assembly.
 */
export type ReadRange = (offset: number, length: number) => Promise<Uint8Array>;
export type ImageInfo = { mime: 'image/png' | 'image/jpeg' | 'image/webp'; width: number; height: number };
export type VideoInfo = { mime: 'video/mp4' | 'video/quicktime'; brand: string; seconds: number; tracks: { handler: string; codec: string }[] };

const ascii = (b: Uint8Array, start: number, len: number) => String.fromCharCode(...b.subarray(start, start + len));
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const u16 = (b: Uint8Array, o: number) => (b[o] << 8) + b[o + 1];

export function sniffImage(head: Uint8Array): ImageInfo | null {
  if (head.length >= 24 && head[0] === 0x89 && ascii(head, 1, 3) === 'PNG' && ascii(head, 12, 4) === 'IHDR') {
    return { mime: 'image/png', width: u32(head, 16), height: u32(head, 20) };
  }
  if (head.length >= 30 && ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') {
    const chunk = ascii(head, 12, 4);
    if (chunk === 'VP8X') return { mime: 'image/webp', width: 1 + (head[24] | (head[25] << 8) | (head[26] << 16)), height: 1 + (head[27] | (head[28] << 8) | (head[29] << 16)) };
    if (chunk === 'VP8 ' && head[23] === 0x9d && head[24] === 0x01 && head[25] === 0x2a) return { mime: 'image/webp', width: (head[26] | (head[27] << 8)) & 0x3fff, height: (head[28] | (head[29] << 8)) & 0x3fff };
    if (chunk === 'VP8L' && head[20] === 0x2f) { const b = head.subarray(21, 25); return { mime: 'image/webp', width: 1 + (((b[1] & 0x3f) << 8) | b[0]), height: 1 + (((b[3] & 0xf) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6)) }; }
    return null;
  }
  if (head.length >= 4 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    // Walk JPEG markers to the first SOFn frame header.
    let o = 2;
    while (o + 9 < head.length) {
      if (head[o] !== 0xff) return null;
      const marker = head[o + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
      const len = u16(head, o + 2);
      if ((marker >= 0xc0 && marker <= 0xcf) && ![0xc4, 0xc8, 0xcc].includes(marker)) return { mime: 'image/jpeg', height: u16(head, o + 5), width: u16(head, o + 7) };
      o += 2 + len;
    }
    return null;
  }
  return null;
}

type Box = { type: string; start: number; size: number; header: number };

async function boxes(read: ReadRange, start: number, end: number, limit = 512): Promise<Box[]> {
  const out: Box[] = [];
  let o = start;
  while (o + 8 <= end && out.length < limit) {
    const h = await read(o, Math.min(16, end - o));
    let size = u32(h, 0), header = 8;
    const type = ascii(h, 4, 4);
    if (!/^[\x20-\x7e]{4}$/.test(type)) throw new Error('malformed box type');
    if (size === 1) { if (h.length < 16) throw new Error('truncated box'); size = u32(h, 8) * 2 ** 32 + u32(h, 12); header = 16; }
    else if (size === 0) size = end - o;
    if (size < header || o + size > end) throw new Error('box exceeds container');
    out.push({ type, start: o, size, header });
    o += size;
  }
  return out;
}

const child = async (read: ReadRange, parent: Box, type: string) => (await boxes(read, parent.start + parent.header, parent.start + parent.size)).find(b => b.type === type);

export async function probeVideo(read: ReadRange, totalBytes: number): Promise<VideoInfo> {
  const top = await boxes(read, 0, totalBytes);
  const ftyp = top[0]?.type === 'ftyp' ? top[0] : undefined;
  if (!ftyp) throw new Error('Not an MP4 or MOV file.');
  const brand = ascii(await read(ftyp.start + ftyp.header, 4), 0, 4);
  const moov = top.find(b => b.type === 'moov');
  if (!moov) throw new Error('The video is missing its index (moov). Re-export it as a standard MP4.');
  if (moov.size > 20_000_000) throw new Error('The video index is unexpectedly large.');
  // One read for the whole index, then parse children in memory (avoids a request per box on object storage).
  const moovBytes = await read(moov.start, moov.size);
  if (moovBytes.length !== moov.size) throw new Error('The video index is truncated.');
  return parseMoov(fromBuffer(moovBytes), { ...moov, start: 0 }, brand);
}

async function parseMoov(read: ReadRange, moov: Box, brand: string): Promise<VideoInfo> {
  const mvhd = await child(read, moov, 'mvhd');
  if (!mvhd) throw new Error('The video header is missing.');
  const mv = await read(mvhd.start + mvhd.header, 32);
  const v1 = mv[0] === 1;
  const timescale = v1 ? u32(mv, 20) : u32(mv, 12);
  const duration = v1 ? u32(mv, 24) * 2 ** 32 + u32(mv, 28) : u32(mv, 16);
  if (!timescale) throw new Error('The video header is invalid.');
  const tracks: VideoInfo['tracks'] = [];
  for (const trak of (await boxes(read, moov.start + moov.header, moov.start + moov.size)).filter(b => b.type === 'trak')) {
    const mdia = await child(read, trak, 'mdia'); if (!mdia) continue;
    const hdlr = await child(read, mdia, 'hdlr');
    const handler = hdlr ? ascii(await read(hdlr.start + hdlr.header + 8, 4), 0, 4) : '????';
    const minf = await child(read, mdia, 'minf');
    const stbl = minf && await child(read, minf, 'stbl');
    const stsd = stbl && await child(read, stbl, 'stsd');
    const codec = stsd ? ascii(await read(stsd.start + stsd.header + 12, 4), 0, 4) : '????';
    tracks.push({ handler, codec });
  }
  const mime = brand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  return { mime, brand, seconds: duration / timescale, tracks };
}

export const allowedVideoCodecs = ['avc1', 'avc3', 'hvc1', 'hev1', 'mp4v', 'av01', 'vp09', 'apcn', 'apch', 'apcs', 'apco', 'ap4h'];

/** Validates a probed reference against PRD P02 rules. Returns a user-facing reason or null. */
export function referenceProblem(info: VideoInfo, declaredMime: string): string | null {
  if (info.mime !== declaredMime && !(declaredMime === 'video/mp4' && info.mime === 'video/quicktime')) return 'The file type does not match its contents.';
  const video = info.tracks.find(t => t.handler === 'vide');
  if (!video) return 'No video track was found.';
  if (!allowedVideoCodecs.includes(video.codec)) return `Unsupported video codec (${video.codec.trim() || 'unknown'}). Use H.264 or HEVC.`;
  if (!(info.seconds >= 5 && info.seconds <= 30)) return 'The reference must be 5–30 seconds.';
  return null;
}

export const fromBuffer = (buf: Uint8Array): ReadRange => async (offset, length) => buf.subarray(offset, Math.min(buf.length, offset + length));
