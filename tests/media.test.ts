import { describe, expect, it } from 'vitest';
import { sniffImage, probeVideo, referenceProblem, fromBuffer } from '@/lib/server/media';

function box(type: string, ...children: Uint8Array[]) {
  const body = children.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(8 + body);
  new DataView(out.buffer).setUint32(0, 8 + body);
  out.set([...type].map(c => c.charCodeAt(0)), 4);
  let o = 8; for (const c of children) { out.set(c, o); o += c.length; }
  return out;
}
const bytes = (...parts: (number[] | string)[]) => new Uint8Array(parts.flatMap(p => (typeof p === 'string' ? [...p].map(c => c.charCodeAt(0)) : p)));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

function mp4({ brand = 'isom', seconds = 10, codec = 'avc1', withMoov = true } = {}) {
  const mvhd = box('mvhd', bytes([0, 0, 0, 0], be32(0), be32(0), be32(1000), be32(seconds * 1000), new Array(80).fill(0)));
  const track = (handler: string, c: string) => box('trak', box('mdia', box('hdlr', bytes([0, 0, 0, 0], be32(0), handler, new Array(12).fill(0), [0])), box('minf', box('stbl', box('stsd', bytes([0, 0, 0, 0], be32(1), be32(16), c, new Array(8).fill(0)))))));
  const ftyp = box('ftyp', bytes(brand, be32(0), brand));
  const mdat = box('mdat', new Uint8Array(64));
  const moov = box('moov', mvhd, track('vide', codec), track('soun', 'mp4a'));
  const parts = withMoov ? [ftyp, mdat, moov] : [ftyp, mdat];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

describe('video probing', () => {
  it('reads brand, duration and codecs with moov after mdat', async () => {
    const file = mp4({ seconds: 12 });
    const info = await probeVideo(fromBuffer(file), file.length);
    expect(info).toMatchObject({ mime: 'video/mp4', seconds: 12, tracks: [{ handler: 'vide', codec: 'avc1' }, { handler: 'soun', codec: 'mp4a' }] });
    expect(referenceProblem(info, 'video/mp4')).toBeNull();
  });
  it('identifies QuickTime and enforces the duration window', async () => {
    const mov = mp4({ brand: 'qt  ', seconds: 31 });
    const info = await probeVideo(fromBuffer(mov), mov.length);
    expect(info.mime).toBe('video/quicktime');
    expect(referenceProblem(info, 'video/quicktime')).toMatch(/5–30/);
  });
  it('rejects unsupported codecs, missing index and non-video bytes', async () => {
    const odd = mp4({ codec: 'xxxx' });
    expect(referenceProblem(await probeVideo(fromBuffer(odd), odd.length), 'video/mp4')).toMatch(/codec/);
    const noMoov = mp4({ withMoov: false });
    await expect(probeVideo(fromBuffer(noMoov), noMoov.length)).rejects.toThrow(/moov/);
    const html = new TextEncoder().encode('<html><body>not a video</body></html>');
    await expect(probeVideo(fromBuffer(html), html.length)).rejects.toThrow();
  });
  it('rejects a box that claims to extend past the file', async () => {
    const file = mp4(); new DataView(file.buffer).setUint32(0, 9999);
    await expect(probeVideo(fromBuffer(file), file.length)).rejects.toThrow();
  });
  it('flags a declared type that does not match the container', async () => {
    const file = mp4();
    expect(referenceProblem(await probeVideo(fromBuffer(file), file.length), 'video/quicktime')).toMatch(/match/);
  });
});

describe('image sniffing', () => {
  it('reads PNG dimensions', () => {
    const png = bytes([0x89], 'PNG', [13, 10, 26, 10], be32(13), 'IHDR', be32(640), be32(480), [8, 6, 0, 0, 0]);
    expect(sniffImage(png)).toEqual({ mime: 'image/png', width: 640, height: 480 });
  });
  it('reads JPEG dimensions past an APP0 segment', () => {
    const jpg = bytes([0xff, 0xd8, 0xff, 0xe0, 0, 16], 'JFIF', new Array(10).fill(0), [0xff, 0xc0, 0, 17, 8, 0x01, 0xe0, 0x02, 0x80, 3], new Array(12).fill(0));
    expect(sniffImage(jpg)).toEqual({ mime: 'image/jpeg', width: 640, height: 480 });
  });
  it('reads WebP VP8X dimensions', () => {
    const webp = bytes('RIFF', [0, 0, 0, 0], 'WEBP', 'VP8X', [10, 0, 0, 0], [0, 0, 0, 0], [0x7f, 0x02, 0], [0xdf, 0x01, 0]);
    expect(sniffImage(webp)).toEqual({ mime: 'image/webp', width: 640, height: 480 });
  });
  it('rejects disguised files', () => {
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImage(new Uint8Array(4))).toBeNull();
  });
});
