/** Original pixel drawing; two leg poses keep the runner crisp at small sizes. */
export function PixelDinosaur() {
  return <svg className="pixel-dinosaur" width="40" height="40" viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">
    <g className="dino-body">
      <path d="M14 2h8v1h1v5h-7v2h4v2h-2v-1h-2v5h-2v2H8v-2H6v-2H4v-2H2V7h2v3h2v2h3v-2h2V8h2V3h1Z" />
      <rect className="dino-eye" x="16" y="4" width="1" height="1" />
      <path className="dino-legs dino-legs-a" d="M9 17h3v4h2v1H9Zm5 0h3v2h-2v2h-2v-1h1Z" />
      <path className="dino-legs dino-legs-b" d="M9 17h3v2h-2v2H8v-1h1Zm5 0h3v4h2v1h-5Z" />
    </g>
  </svg>;
}

export function FinishFlag() {
  return <svg width="18" height="24" viewBox="0 0 18 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true"><path d="M2 2h2v21H2Zm2 0h4v4H4Zm8 0h4v4h-4ZM8 6h4v4H8Zm-4 4h4v4H4Zm8 0h4v4h-4Z" /></svg>;
}
