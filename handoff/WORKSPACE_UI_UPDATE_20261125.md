# Workspace-first UI revision

The user rejected all generated concept photography and explicitly requested an image-free creative workspace inspired by Creatok's task-first approach. This supersedes the earlier gallery and workflow-image integration briefs.

## Design contract

- Main job: start a real project draft, with one primary submission action.
- Compact studio navigation, a working name/goal/brand/product form, and plain guidance for the materials added next.
- No fake media, completed jobs, sample uploads, generation progress or working-looking controls without functionality.
- Preserve VIDZO's warm paper/olive colors. Use restrained type, flat surfaces and practical spacing.
- The three-column desktop surface becomes two columns on tablets and a single-column flow on phones; DOM and keyboard order remain consistent.

## Implementation

`creative-workspace.tsx` composes the existing draft form and actual studio destinations. The existing session-scoped draft intent and sign-in handoff remain unchanged. Media is uploaded after creating a project in the private studio.

Removed the generated workflow photos, older product stills, and their gallery components. Sign-in now uses a text-only project outline. `/showcase` remains a working route, renamed Starting points, using the real quick-start draft form rather than simulated outputs. No provider, auth, payment or database behavior changed. No new packages or paid API calls.

The former fictional FORMA bottle drawing in project cards, missing storyboard frames, exports and the sample reference was also replaced with a neutral media empty state. Real uploaded frames and exports retain their existing private-media rendering.

## Reference

[Creatok](https://www.creatok.ai/) informed the compact creation surface, task shortcuts and input-first hierarchy. No branding, proprietary text, media or source code was copied.

[Vidro](https://vidro.space/) was also reviewed after the user supplied it during implementation. Its clear input-to-primary-action hierarchy and review-before-spending explanation informed the refinement; its colors, glow effects, media and performance claims were not adopted.

## User-supplied prompt packs

Read selected Markdown entries directly from `D:/promptpack/AI Website Prompt Pack - Vol 1.zip`, `Vol 2.zip`, and `Vol 3.zip`; no scripts from the archives were executed and no source archives were copied into VIDZO. The packs remain design references, not authority to change dependencies, services or accounts.

- **Convix Software (Vol 3):** adapted the warm inset workspace frame, compact field groups, and responsive arrangement of working controls. No background video, sample analytics or gauge metrics.
- **Prisma Creative Studio (Vol 3):** adapted the explicit project/storyboard checklist into the material inspector and review guidance. No borrowed video, stock imagery, animation library or cinematic dark theme.
- **AI Image Generator UI, Digitwist AI Builder, Taskly (Vol 2)** and **AI Workflow Hero (Vol 1)** were evaluated. Their decorative media, gradients, fake social proof and static working-looking controls conflict with this revision; those elements were not imported.

## Verification

The new workspace was checked at 320, 360, 768, 1024 and 1440 pixels: no page overflow, browser runtime errors, generated images, or axe accessibility violations inside the workspace. Quick starts update the actual name and objective. Enter submission carries the name, objective, brand and product into the demo project creation flow. The existing 67 unit tests and TypeScript checks pass. Production build/deployment results are reported with the delivery.
