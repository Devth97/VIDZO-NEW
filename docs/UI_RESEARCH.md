# VIDZO conversion and visual direction

Reviewed 25 November 2026. Public-page audit of six relevant competitors, including the user-selected Creatok reference; authenticated dashboards and private conversion rates were not accessible. Changes are hypotheses to measure, not proven conversion lifts.

| Public reference | Observed pattern | VIDZO application |
| --- | --- | --- |
| [Creatify](https://creatify.ai/) | Task-specific entry points; repeated creation/demo actions | One clear draft action, visual workflow, contextual next steps |
| [Arcads](https://www.arcads.ai/) | Immediate creation and Google continuation, visual examples | Consistent CTA and uncluttered sign-in; no copied actors or promotions |
| [Higgsfield](https://higgsfield.ai/) | Media-first exploration | Editorial media and selectable directions, labeled as illustrative |
| [AdCreative.ai](https://www.adcreative.ai/) | Use-case selection | Working category filters tied to concept details |
| [Pencil](https://trypencil.com/) | Product narrative connected to buyer concerns | Visible approval, pricing and review sequence; no borrowed enterprise claims |
| [Creatok](https://www.creatok.ai/) — user-selected reference | Prominent task composer, quick-start choices and staged approvals | A real draft starter with name suggestions, private same-tab handoff to the project modal and a visible next action; no pretend chat, media generation or publishing capabilities |

## Repository references

Checked [GitHub Trending](https://github.com/trending). [google-labs-code/stitch-skills](https://github.com/google-labs-code/stitch-skills) and [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) appeared there: useful references for intentional design systems and editorial hierarchy. No scripts or agent instructions were installed/executed.

Reviewed [shadcn/ui](https://github.com/shadcn-ui/ui) (MIT), [Magic UI](https://github.com/magicuidesign/magicui) (MIT), and [Motion](https://github.com/motiondivision/motion) for composable controls, visible states and restrained transitions. They are popular component references, not claims about today's top trend ranking. No third-party code was copied or runtime dependency added.

## Design contract

- Homepage: one **Start a free draft** action. Free means project creation, not AI generation. Secondary exploration works without sign-in.
- Warm paper, olive ink, generous typography, large asymmetric hero, numbered process and product photography. No purple glows, fabricated metrics, fake play buttons or generic repeated feature grids.
- Images are original AI-created concept stills, not customer work or video output. Functional filters and accessible details explain the distinction.
- Prices retain existing source of truth and provisional/live pricing gates. No invented discounts, free credits or subscriptions.
- Responsive at 360/768/1440px, visible keyboard focus, mobile menu closes on selection/Escape. Respect reduced motion. Eager high-priority hero, lazy below-fold images, responsive WebP and reserved image dimensions.
- Preserve auth, consent, wallet and spend gates; never imply unconfigured services are ready.

## Measurement

After consented aggregate analytics is configured, compare draft starts, sign-in completion, first saved draft and pricing-to-wallet navigation. No tracking service is introduced in this change.

## Verification

Isolated Chrome: homepage, creative directions, pricing and demo workspace at 360/768/1440px; no page overflow, broken images after load, uncaught errors or axe WCAG A/AA violations. Checked working category filters, concept dialog Escape, mobile menu close/Escape, draft CTA navigation and autofocus. Live-mode sign-in checked at the same widths; consent blocked submission until checked, then the route was intercepted to test error recovery without sending credentials or creating an account. These checks do not establish a conversion lift or verify an actual new Google login.

Three original concept images are delivered as responsive WebP assets (480/900px). Their combined six files are approximately 241 KB. Generated masters remain outside Git. Images remain explicitly illustrative and no fake output playback is presented.

Creatok follow-up: inspected its public homepage in isolated Chrome. Applied the prominent task-entry surface and quick-start choices to a draft-name form, preserving VIDZO's warm visual language. Verified suggestions, typed-name handoff to the project modal, no name in URL, preservation through the signed-out gate and `/projects?new=1` return path. Names are stored only in sessionStorage for the current tab and consumed on entering projects; no fake generation or provider call is made. Storage failure falls back to the existing project creation controls.
