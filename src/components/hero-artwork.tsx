/** Original concept art, kept distinct from supplied reference clips and real outputs. */
export function HeroArtwork() {
  return <aside className="hero-artwork" aria-label="Illustrative campaign concept">
    <figure className="hero-art hero-art-studio">
      <img src="/assets/hero/citrus-studio-480.webp" srcSet="/assets/hero/citrus-studio-240.webp 240w, /assets/hero/citrus-studio-480.webp 480w" sizes="(min-width: 1200px) 180px, 80px" width={480} height={720} alt="AI concept: a citrus drink bottle with sunlit water droplets" fetchPriority="high"/>
      <figcaption><span>01 / THE PRODUCT</span>A little more unexpected.</figcaption>
    </figure>
    <figure className="hero-art hero-art-lifestyle">
      <img src="/assets/hero/citrus-lifestyle-v2-480.webp" srcSet="/assets/hero/citrus-lifestyle-v2-240.webp 240w, /assets/hero/citrus-lifestyle-v2-480.webp 480w" sizes="(min-width: 1200px) 180px, 80px" width={480} height={720} alt="AI concept: the same citrus drink held beside a sunlit tennis court"/>
      <figcaption><span>02 / THE MOMENT</span>A story of its own.</figcaption>
    </figure>
    <p className="hero-art-note">One product.<br/><strong>More possibilities.</strong><small>AI concept artwork<br/>Not a VIDZO video result</small></p>
  </aside>;
}
