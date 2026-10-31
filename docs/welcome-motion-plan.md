# Skift welcome page — motion design plan

Status: motion treatment implemented across all planned sections at `/welcome`.

## Hero implementation

The hero uses a finite CSS entrance timeline lasting 1.6 seconds. The headline reveals by line, supporting copy settles into view, and the central workspace panel assembles before the team and activity cards. Metrics and suggested-action chips follow in a short stagger. Desktop includes a soft light sweep, halo reveal, and connecting SVG strokes; the composition then rests.

Actions remain visible and usable during the entrance. The Replay intro button restarts only CSS entrance animations without remounting content or moving keyboard focus. An IntersectionObserver and document visibility listener pause playback offscreen or in a hidden tab. Mobile removes horizontal card travel, rotation, connector strokes, and the light sweep. Reduced-motion preferences show the complete static composition and hide replay. No new animation dependency was added.

Implementation is limited to `app/welcome/welcome-page.tsx` and `app/welcome/welcome.module.css`. The wider AI workflow has not been animated in this milestone.

Validation: TypeScript and production build pass. Twenty-one Chrome checks cover completion timing, keyboard replay, immediately usable actions, offscreen pause/resume, desktop/mobile layouts (including 320px), reduced motion, no-JavaScript content, and runtime errors. The build retains the existing Next.js middleware deprecation warning.

Review artifacts under `artifacts/welcome/`:

- `hero-motion-preview.gif`: sampled browser-rendered timeline, looping for review; the actual page plays once.
- `hero-motion-desktop.png` and `hero-motion-mobile.png`: completed composition.
- `hero-reduced-motion.png`: static accessible variant.
- `hero-motion-verification.json`: browser check results.

## Goal

Show Skift as a connected restaurant workspace where AI helps turn a goal into practical next steps. Motion should explain relationships between people, communications, tasks, attendance, alerts, and information, while giving visitors enough time to understand the product.

Keep the established DM Sans typography, muted green palette, cream surfaces, restaurant photography, and glass panels. Develop a calm, purposeful motion language suited to a busy restaurant team.

## Main story

The visitor journey is:

1. Meet the workspace.
2. See how AI connects the work.
3. Explore the tools and their relationships.
4. Try the workspace previews.
5. Open a workspace or learn more.

The central animated sequence is:

**Goal → Relevant workspace context → Suggested actions → Human review**

Example: “Help me get the restaurant ready for Friday lunch.” The sequence brings schedule coverage, opening tasks, and team communication together, then reveals a proposed shift, checklist, and briefing draft. It ends with a review state. The existing Product vision preview label stays visible throughout.

## Section storyboard

| Section | Proposed motion | Purpose |
| --- | --- | --- |
| Hero | Reveal the headline by line, followed by supporting copy and actions. Assemble the team, workspace, and activity cards into one composition. Add a restrained light sweep through the background. | Establish one connected workspace in the opening moment. |
| Restaurant context | Reveal the photograph and copy as they enter view. Bring the four value points in with a short stagger. | Connect the product to real restaurant work. |
| AI workflow | Use a sticky story panel on larger screens. As visitors progress, the request is established, relevant context cards connect, suggested outputs form, and the review step settles into view. Provide direct step selection and a replay option. | Make the role of AI understandable through a complete example. |
| Feature directory | Present the twelve tools in four groups: people and culture; communication and alerts; daily work; insights and knowledge. Reveal groups progressively and animate a shared selection indicator. Keep all features readable and accessible. | Make the full feature set easy to scan and show how it belongs together. |
| Workspace tour | Crossfade between tabs with a small directional movement. Animate local task completion, achievement recognition, clock-in status, and message insertion. | Show immediate, understandable feedback from visitor actions. |
| AI scenario selection | Transition between context chips and proposed actions when a scenario changes. Cancel the previous transition when another scenario is chosen. | Help visitors compare workflows without abrupt content swaps. |
| FAQ and closing action | Smoothly expand answers. Reveal the final headline and call to action with one restrained entrance. | Finish with clarity and a clear destination. |

## Hero sequence

Target the main entrance to complete in approximately 1.2–1.6 seconds:

1. Navigation and first headline line appear.
2. Second headline line follows with a small vertical reveal.
3. Supporting copy and actions become visible.
4. The central workspace panel settles into position.
5. Team and activity panels join it, with a subtle connecting accent.

The composition then rests. Text and actions remain available throughout. Any pointer-responsive depth should be small, limited to appropriate desktop pointers, and disabled when reduced motion is requested.

## AI workflow sequence

Use four readable stages with a visible progress indicator:

1. **The goal:** display the example request in full. A short input accent can suggest an instruction arriving without forcing visitors to wait for a typewriter effect.
2. **The context:** highlight the relevant schedule, task, channel, or document cards. Draw connecting lines between the selected sources and the assistant.
3. **The work:** reveal the suggested outputs in order, showing how they relate to the request.
4. **The review:** gather the outputs into a stable plan with a clear human review label.

Visitors can select a stage or scenario directly and replay the sequence. If an automatic timed sequence is used, include pause controls and stop it when the section leaves the viewport or the user interacts. The default desktop scroll treatment must preserve normal scrolling and a direct route to later content.

On mobile, use a normal vertical sequence with short in-view transitions. Avoid extended pinning, deep parallax, and wide connector paths.

## Motion language

- Feedback: approximately 120–180 ms.
- Panel and tab transitions: approximately 220–350 ms.
- Section reveals: approximately 450–650 ms, with a short stagger.
- Use restrained movement, typically 8–24 px for content reveals.
- Use consistent easing that settles smoothly.
- Concentrate the strongest motion in the hero and AI story. Keep supporting sections quieter.
- Avoid animating every individual feature label or using continuous bouncing elements.

These values are starting points and should be adjusted after reviewing the prototype at actual viewport sizes.

## Implementation approach

Build on the existing Next.js page and native React interface previews. Start with CSS transforms and opacity, viewport observation for entrance triggers, and a reusable timeline controller for the AI sequence. Prefer updating animation progress without triggering React renders on every scroll frame.

Create a small shared set of primitives for section reveals, staggered children, panel transitions, and workflow steps. A dedicated animation dependency can be considered if the scroll sequence or transitions become materially easier to maintain with it; select that during implementation.

Animate reusable DOM and SVG interface elements so text remains sharp and accessible. The existing photograph can be retained. Additional heavy video or 3D assets are not needed for the proposed direction.

## Accessibility and performance

- Respect `prefers-reduced-motion` in CSS and JavaScript. Show complete, readable static states when motion is reduced.
- Preserve native scrolling, keyboard access, visible focus, and direct controls for the workflow.
- Keep headings, content, and calls to action available without waiting for a sequence to finish.
- Pause ongoing motion offscreen and when the page is hidden.
- Favour transforms and opacity; limit animated blur and shadow effects.
- Prevent layout shifts when panels change.
- Preserve the distinction between currently available tools and Product vision previews. Animation must not imply that a real AI action was performed.
- Keep illustrative metrics labelled as examples and avoid introducing fabricated performance claims through animated counters.

## Delivery stages

1. **Motion foundation and storyboard:** agree the core sequence, motion settings, and mobile treatment using this plan.
2. **First reviewable implementation:** build the hero entrance and one complete AI workflow. Review their pacing together before expanding the treatment.
3. **Full page treatment:** apply the motion language to the grouped feature directory, workspace tour, local interaction feedback, FAQ, and closing section.
4. **Verification and handoff:** check desktop and mobile layouts, keyboard navigation, reduced motion, offscreen behaviour, and page responsiveness. Run TypeScript and production-build checks. Deliver updated screenshots, short motion recordings, and the reusable motion components.

The recommended first milestone is the hero plus the shift-preparation AI story. Those sections establish the motion language and demonstrate the central product promise.

## Restaurant context and walkthrough implementation

Restaurant copy, photo, and benefits receive finite viewport-triggered reveals. The AI walkthrough offers four directly selectable stages and replay, with native-scroll progression in a sticky panel on desktop screens at least 900px wide and 800px tall. Mobile and reduced-motion layouts retain the full readable workflow with direct stage controls. Scenario changes reset the selected stage and restart a brief transition. Product vision labels remain visible in the sticky panel. No automatic timer or new dependency is used.


## Remaining sections — implementation and verification

The twelve features are organised into four visible groups, with anchor navigation and an animated selection indicator. Groups reveal as they enter the viewport. The workspace tour transitions with a directional fade; local task completion, recognition, attendance status, and messages provide brief feedback. FAQ answers animate their height in browsers supporting details-content and interpolate-size, with native details behavior as the fallback. Supporting content and the closing headline receive finite reveals.

Reduced-motion preferences disable animation and transitions throughout. All feature content remains in the document. No new dependencies were introduced.

Validation: TypeScript, production build, and git diff whitespace checks passed. Thirty-four browser checks passed with no runtime exceptions, including the previously unverified context and AI walkthrough, desktop/mobile layouts, 320px overflow, keyboard tabs, all scenarios, replay, local interactions, FAQ expansion/collapse, and reduced motion.

Review artifacts: `full-motion-verification.json`, `motion-feature-groups.png`, `motion-mobile-features.png`, `motion-ai-walkthrough.png`, `motion-faq.png`, and `motion-closing.png` in `artifacts/welcome/`.
