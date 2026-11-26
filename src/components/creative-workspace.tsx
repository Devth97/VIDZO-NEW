import { ProjectsLink } from './projects-link';
import { IdeaComposer } from './idea-composer';

/** A focused entry into the studio, without duplicating its navigation or inspector. */
export function CreativeWorkspace() {
  return <section className="creative-entry" aria-labelledby="workspace-title" id="new-draft">
    <div className="entry-heading"><p className="entry-kicker"><span className="status-dot"/>VIDZO studio · Private beta</p><h1 id="workspace-title">Turn inspiration<br/>into <em>your next ad.</em></h1><p>Your product. Your cast. Your creative direction.<br/>{' '}Start with an idea and make the brief your own.</p></div>
    <IdeaComposer/>
    <ProjectsLink/>
  </section>;
}
