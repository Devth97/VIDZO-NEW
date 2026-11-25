const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Labelled placeholder artwork for the local test backend and demo. It must always read as a test fixture,
 * never as generated output. 1080×1920 (9:16) for frames/clips; 1200×1200 for identity sheets.
 */
export function placeholderSvg(kind: 'frame' | 'character' | 'clip', title: string, version: number, accent = '#445A39'): string {
  const sheet = kind === 'character';
  const [w, h] = sheet ? [1200, 1200] : [1080, 1920];
  const label = kind === 'frame' ? 'STORYBOARD FRAME' : kind === 'clip' ? 'SCENE CLIP' : 'IDENTITY SHEET';
  const color = /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#445A39';
  const views = sheet ? ['FRONT', 'PROFILE', 'THREE-QUARTER', 'FULL BODY'].map((v, i) => `<g transform="translate(${60 + i * 280} 330)"><rect width="250" height="520" rx="18" fill="#F0EDE5" stroke="#DEDBD2" stroke-width="3"/><circle cx="125" cy="140" r="58" fill="#DEDBD2"/><rect x="65" y="220" width="120" height="230" rx="40" fill="#DEDBD2"/><text x="125" y="495" text-anchor="middle" font-size="22" fill="#6B6D62" font-family="sans-serif" letter-spacing="2">${v}</text></g>`).join('') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(`Local test placeholder ${label.toLowerCase()} – not AI output`)}">
<rect width="${w}" height="${h}" fill="#F7F5F0"/>
<rect x="24" y="24" width="${w - 48}" height="${h - 48}" rx="36" fill="none" stroke="${color}" stroke-width="6" stroke-dasharray="24 18"/>
<text x="${w / 2}" y="${sheet ? 150 : 260}" text-anchor="middle" font-family="sans-serif" font-size="${sheet ? 40 : 54}" font-weight="700" fill="#282B25" letter-spacing="4">${label}</text>
<text x="${w / 2}" y="${sheet ? 215 : 340}" text-anchor="middle" font-family="sans-serif" font-size="${sheet ? 32 : 40}" fill="#445A39">${esc(title.slice(0, 48))} · v${version}</text>
${views}
${sheet ? '' : `<rect x="390" y="700" width="300" height="520" rx="60" fill="#F0EDE5" stroke="#DEDBD2" stroke-width="4"/><rect x="460" y="620" width="160" height="110" rx="24" fill="${color}"/>`}
<rect x="80" y="${h - (sheet ? 230 : 380)}" width="${w - 160}" height="${sheet ? 150 : 220}" rx="24" fill="#282B25"/>
<text x="${w / 2}" y="${h - (sheet ? 165 : 280)}" text-anchor="middle" font-family="sans-serif" font-size="${sheet ? 34 : 44}" font-weight="700" fill="#FFFEFA">LOCAL TEST PLACEHOLDER</text>
<text x="${w / 2}" y="${h - (sheet ? 115 : 215)}" text-anchor="middle" font-family="sans-serif" font-size="${sheet ? 26 : 32}" fill="#C8D5AB">No AI model was called. Not a generated ${kind === 'clip' ? 'video' : 'image'}.</text>
</svg>`;
}
