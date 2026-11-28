import { ProjectsLink } from './projects-link';
import { IdeaComposer } from './idea-composer';
import { VideoShowcase } from './video-showcase';
import { GrainGlow } from './effects/grain-glow';
import { DecodeWord } from './effects/decode-word';
import { HeroArtwork } from './hero-artwork';

/** A focused entry into the studio, without duplicating its navigation or inspector. */
export function CreativeWorkspace() {
  return <section className="creative-entry" aria-labelledby="workspace-title" id="new-draft">
    <GrainGlow/>
    <div className="entry-heading"><p className="entry-kicker"><span><span className="status-dot"/>The product ad studio · Private beta</span></p><h1 id="workspace-title">Turn your product<br/>into <em>your next <DecodeWord words={['ad.', 'launch.', 'offer.', 'reveal.']}/></em></h1><p>Plan an original 10–15 second ad with your product and creative direction.<br/>{' '}Review every scene and the price before generation.</p></div>
    <HeroArtwork/>
    <IdeaComposer/>
    <ProjectsLink/>
    <VideoShowcase/>
  </section>;
}
