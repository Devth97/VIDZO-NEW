# VIDZO UI component sources

The public site uses a curated set of source components, adapted to its existing beige/olive tokens. No additional UI framework or component-package dependency was installed. Source revisions were checked on 28 November 2026.

| Repository | Integrated component | VIDZO changes |
| --- | --- | --- |
| [Magic UI](https://github.com/magicuidesign/magicui/tree/1278d872938a718a27fd026da314f3c0f48d85e6) | [Border Beam](https://github.com/magicuidesign/magicui/blob/1278d872938a718a27fd026da314f3c0f48d85e6/apps/www/registry/magicui/border-beam.tsx) | `src/components/magic/border-beam.tsx`: retained masked border and Motion offset-path animation; translated utility styles to CSS, olive palette, reduced motion and offscreen/hidden-tab suspension. Used in the homepage composer and creative playground. |
| [React Bits](https://github.com/DavidHDev/react-bits/tree/8252a56864a29d98e990b88e7c45bb0ddb81a124) | [SpotlightCard](https://github.com/DavidHDev/react-bits/blob/8252a56864a29d98e990b88e7c45bb0ddb81a124/src/ts-default/Components/SpotlightCard/SpotlightCard.tsx) | `src/components/magic/spotlight-card.tsx`: adapted delta-time pointer smoothing and settled-frame termination; retained VIDZO's CSS surface, removed unused ambient/flare/theme machinery, added live reduced-motion preference and hidden-tab cancellation. Used by the benefits cards. |
| [Motion](https://github.com/motiondivision/motion) | Existing `motion/react` dependency | Powers Border Beam and existing layout transitions. Version remains pinned in `package.json` and the lockfile. |

Magic UI is MIT licensed; full notice: [licenses/magic-ui.txt](../licenses/magic-ui.txt). React Bits uses **MIT + Commons Clause**, not unrestricted MIT; full terms: [licenses/react-bits.txt](../licenses/react-bits.txt). Its components are used as part of VIDZO's website, not redistributed as a component library or offered as a copy of React Bits' tools.

The grain shader, decoding headline, particle heading, running dinosaur and interactive video-direction playground are VIDZO implementations. Reference videos are the supplied clips already tracked with their provenance; they are not generated results.

For future interfaces, [shadcn/ui](https://github.com/shadcn-ui/ui) and [Radix Primitives](https://github.com/radix-ui/primitives) are candidates for complex accessible controls. They were not added in this change: the existing native controls already cover the current interactions. Avoid importing multiple overlapping UI systems just to accumulate repositories.

Design contract: retain the warm editorial identity and readable server-rendered content; use shaders for atmosphere, moving light for focus and interaction-linked transitions for feedback. Videos remain silent, looping, autoplaying with no playback controls. Respect system reduced motion, stop canvas/video work offscreen, preserve the draft handoff, and fit the reference cards within the viewport.
