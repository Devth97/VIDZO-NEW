import { ProjectsLink } from './projects-link';
import { IdeaComposer } from './idea-composer';
import { GrainGlow } from './effects/grain-glow';
import { DecodeWord } from './effects/decode-word';

/** A focused entry into the studio, without duplicating its navigation or inspector. */
export function CreativeWorkspace() {
  return <section className="creative-entry" aria-labelledby="workspace-title" id="new-draft">
    <GrainGlow/>
    <div className="entry-heading"><p className="entry-kicker"><span><span className="status-dot"/>VIDZO studio · Private beta</span></p><h1 id="workspace-title">Turn inspiration<br/>into <em>your next <DecodeWord words={['ad', 'launch', 'offer', 'reveal']}/>.</em></h1><p>Your product. Your cast. Your creative direction.<br/>{' '}Start with an idea and make the brief your own.</p></div>
    <IdeaComposer/>
    <ProjectsLink/>
  </section>;
}
