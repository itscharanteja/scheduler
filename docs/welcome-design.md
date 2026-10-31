# Skift landing page

## Delivery

Public route: `/welcome`. Run `npm run dev` and open the route on the local server.

- `app/welcome/page.tsx`: page metadata and server entry.
- `app/welcome/welcome-page.tsx`: landing page, product illustrations, and interactive previews.
- `app/welcome/workspace-previews.tsx`: workspace dashboard, complete feature directory, and interactive AI vision scenarios.
- `app/welcome/welcome.module.css`: isolated design styles and responsive behavior.
- `public/images/skift-restaurant-team.webp`: original generated editorial restaurant image, optimized to approximately 132 KB.
- `public/images/skift-mark.svg`: reusable brand mark.
- `artifacts/welcome/desktop.png`: full desktop presentation.
- `artifacts/welcome/mobile.png`: full mobile presentation.
- `artifacts/welcome/desktop-hero.png` and `mobile-hero.png`: first-screen previews.
- `artifacts/welcome/ai-vision-preview.png`: a report-and-document AI vision scenario.
- `artifacts/welcome/workspace-preview.png`: the new workspace overview with tasks, achievements, and an alert.
- `artifacts/welcome/mobile-features.png`: the readable single-column feature directory on a narrow phone.
- `artifacts/welcome/verification.json`: browser verification results.

The existing dashboard stays at `/`. Middleware allows unauthenticated access to `/welcome` and public image assets. Workspace calls to action use the existing `/login` route.

## Visual direction

The reference informs typography, transparent surfaces, rounded panels, and spacing. The user-selected Warm Hospitality palette replaces the original monochromatic green theme across the public welcome page. Typography and motion remain unchanged.

| Token | Value | Use |
| --- | --- | --- |
| Cream | `#FFF8F0` | Page background |
| Espresso | `#30251F` | Primary text |
| Terracotta | `#C65B3B` | Hero, closing section, brand accents |
| Apricot | `#F6BB86` | People, achievements, warm highlights |
| Warm brown | `#8F4B30` | Operational icons, status controls, and selected states |
| Warm apricot | `#FBEAD9` | AI, communication, and knowledge surfaces |

Darker shades carry small text and selected controls; lighter tints distinguish preview cards and section surfaces. The restaurant photograph retains its original colors.

Palette validation: TypeScript, production build, and 34 browser interaction/layout checks passed. Desktop and mobile screenshots have been refreshed. Historical hero GIFs from the original motion milestone still show the earlier palette.

## Content and behavior

1. Hero: “Your restaurant. One AI workspace.” with a central workspace overview, a people card, and a timely stock-alert preview.
2. Capability strip covering AI assistance, people, communication and culture, and operations.
3. Restaurant life section focused on reducing manual coordination and making the next step clear.
4. Prominent AI section labelled “Product vision preview.” Four interactive scenarios connect work across shift preparation, team coordination and recognition, activity review, and reports and documents.
5. A twelve-feature directory: scheduling, communication, AI agents, activity and alerts, team management, social feed and achievements, tasks and checklists, attendance, reports, documents, forms and logs, and inventory and sales.
6. Interactive product tour, starting with a workspace overview that combines tasks, a personal achievement, and an alert. Additional tabs cover scheduling, attendance, and chat.
7. Swedish restaurant context, language support, and branch management.
8. Native, keyboard-accessible FAQ accordions, including explicit current-versus-vision AI information.
9. A workspace-focused closing call to action and footer.

All people, schedules, messages, checklist items, and metrics in previews are illustrative. Task completion, achievement recognition, attendance toggles, and chat messages use component-local state, never call the application APIs, and reset when their tab is unmounted. The interface examples are custom marketing compositions rather than screenshots of the current dashboard. AI scenario selection changes the illustrated request and proposed workflow; it does not invoke an AI API or perform the depicted actions.

The central positioning is an AI-assisted restaurant workspace that reduces the work of planning, searching, writing, and following up across everyday operations. Scheduling is one of the workspace tools, rather than the primary product identity.

At the user's direction, broader AI workflows, full document management, and custom report creation are labelled “Product vision preview.” AI schedule drafting is described as available today. Every feature includes an explicitly labelled AI vision idea, and the AI section and FAQ explain this distinction. The future workflows prepare drafts and suggested next steps for human review.

There are no invented customer testimonials, customer logos, pricing, productivity figures, or guarantees of legal compliance. Account links reflect the existing sign-in flow rather than promising open registration.

The page includes a skip link, focus indicators, keyboard navigation between product tabs, a mobile navigation menu, reduced-motion handling, and horizontally scrollable schedules on narrow screens.

## Image provenance and generation prompt

Generated with the built-in image generation tool, then converted from PNG to WebP using Sharp. No reference pixels were reused. Original generation is retained in the Codex generated-images directory; the final project asset is `public/images/skift-restaurant-team.webp`.

Final prompt:

> Use case: photorealistic-natural. Asset type: original editorial photograph for Skift, a Swedish restaurant team scheduling product landing page. Create a premium, realistic candid photograph inside a small contemporary Scandinavian quick-service burger restaurant before lunch service. A female restaurant shift leader in her early 30s, wearing a natural oat-colored shirt and dark forest-green apron, stands at a warm oak service counter looking at a slim tablet, with a male teammate in a matching apron casually preparing the counter in the softly blurred middle distance. The people feel human, relaxed and focused, no posing for camera. Interior: sage-green tiled counter front, dark green cabinetry, stainless steel open kitchen details, natural oak, an amber pendant light, late morning window light. Art direction: Kinfolk editorial photography, warm cream highlights, muted pine-green shadows, rich but quiet color, real fabric and skin texture, restrained film grain, slight depth of field, premium independent Scandinavian restaurant. Wide landscape 3:2 composition, main shift leader at right-center, leave quieter dark green counter area bottom left for an HTML interface overlay later. Camera eye level, 35mm lens. No visible logos, no readable writing, no UI, no badges, no graphic overlays, no watermarks. This is a photograph asset, not a website mockup.

## Validation

- TypeScript: `tsc --noEmit --incremental false`.
- Production build: `npm run build`.
- Chrome browser checks at 1440, 390, and 320 CSS pixels: public route, horizontal overflow, AI scenarios, complete feature coverage, workspace tasks and achievement recognition, product tabs, schedule view, local attendance, local chat, FAQ, mobile menu, anchor targets, sign-in destinations, and image loading.
- The build retains the existing Next.js warning about migrating `middleware.ts` to `proxy.ts`.

This work is local to the repository; it has not been deployed.

Lavender accents removed at user request. AI panels, badges, sidebars, icons, and preview cards now use apricot surfaces and dark terracotta text.

Hero viewport sizing: uses the small viewport height minus the outer frame, responsive headline/spacing, and compact preview sizing for short desktop windows. Mobile retains the central workspace card; side cards are omitted. Very short desktop landscape shows the headline and actions without the decorative previews. Verified fit with no horizontal overflow at 1440×900, 1366×768, 1280×720, 1024×600, 390×844, 375×667, 320×568, and 844×390. Updated previews: `artifacts/welcome/viewport-desktop.png` and `viewport-mobile.png`.

Sage accents removed at user request. The welcome page now uses apricot surfaces, cream backgrounds, and warm brown/terracotta text and controls throughout. Existing class names for example avatar tones remain for compatibility.
