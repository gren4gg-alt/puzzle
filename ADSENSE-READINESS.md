# Broshere: AdSense review preparation

Updated 18 September 2026. Changes are local; no deployment or AdSense review request has been made.

## Google's requirements

Google emphasizes original, useful content, clear navigation, and policy compliance. Its eligibility and rejection guidance does not establish a fixed word count, article count, traffic target, or site age that guarantees approval. Longer pages help only when they answer real questions. See [site readiness](https://support.google.com/adsense/answer/7299563?hl=en), [rejection guidance](https://support.google.com/adsense/answer/81904?hl=en), and [eligibility](https://support.google.com/adsense/answer/9724?hl=en).

Google disallows ads on screens with no or low-value publisher content and replicated content without added value. Gameplay is not automatically prohibited, but advertising must follow the applicable policies. See [inventory value](https://support.google.com/publisherpolicies/answer/10502938?hl=en-GB).

## Completed locally

- Added a static guide library and ten guides: Model Workbench, Cozy Fit, Ball Runner, Word Fall, Dune Runner, Drift Hop, sharing photo puzzles, choosing puzzle difficulty, photo dimensions, and compression quality. Each guide has roughly 800–1,800 words including navigation. These are measurements, not Google thresholds.
- Expanded the three tool pages with steps, examples, limitations, troubleshooting, and related reading. Total visible text is roughly 1,000–1,250 words per tool.
- Made home and game directory cards ordinary HTML links and added selection guidance. Standardized navigation and site information links.
- Integrated Cozy Fit under `games/cozy-fit-game/`, with map-page instructions, a full guide, support/privacy links, and 50 levels. Its advertising is disabled.
- Removed automatic ad loaders from fullscreen games, obsolete ad placeholders, and the fake rewarded-ad download timer. Existing loaders remain on tool/directory pages; new guides do not load ads.
- Removed unsupported photo-compliance and quality promises. Explained dimensions, pixel output, file size, and acceptance limitations.
- Updated About, Contact, and Privacy to reflect the tools, games, local storage, third-party resources, and advertising disclosures.
- Updated the sitemap to 26 URLs. Model Workbench is now integrated, with a generated sample, instructions, a full guide, privacy information, and inclusion in site checks.

These changes address content and usability weaknesses. They cannot establish the exact reason for previous decisions or guarantee approval.

## Validation

- Automated checks cover 34 HTML pages, local references, anchors, metadata presence, duplicate IDs, sitemap targets, and JavaScript syntax.
- All 50 Cozy Fit stored solutions fill their boards exactly, without overlap or out-of-bounds cells.
- Desktop and phone layouts were checked for primary pages and guides; game menus and guide links were inspected.
- Photo puzzle creation, direct download, reload into Solve, and completion passed with a generated image.
- Photo resizing produced a 276 × 354 pixel JPEG within a 50 KB limit.
- Image and audio compression produced smaller downloadable results. Video export was not tested end to end.
- Word Fall and Ball Runner started successfully. Cozy Fit's tutorial completed in four moves with three stars and level 2 unlocked. Help and the disabled-ad settings state worked.
- Model Workbench generated a textured, animated sample and reduced its GLB from 180.1 KB to 61.3 KB. The download reopened successfully. FBX export reimported with its texture, geometry, and four-second animation. KTX2 processing completed and reduced the sample's estimated texture memory; the encoded file was larger. These sample checks do not verify every format, complex rig, or external application's importer.

These are local checks in one browser, not a full device matrix or a live AdSense audit.

## Before requesting review

1. Publish the updated public files, including `assets/`, `guides/`, and `games/`. Include `model-workbench.html` and its guide.
2. Open the live home page, tools, guides, and games on a phone and desktop. Confirm HTTPS, the canonical domain, successful resource loading, and that hosting caches serve the new files.
3. Confirm `robots.txt` and `sitemap.xml` are accessible and the host permits Google's crawlers. Submit the sitemap in Search Console and inspect a few guide URLs. Indexing is useful diagnostic information, not an approval guarantee.
4. Verify site ownership in AdSense and that the account publisher ID matches the site code and `ads.txt`. The existing ID was preserved, not verified against the account. Follow the precise issue shown in the account if it differs from low-value content.
5. Check the live ad configuration. Keep ads away from game controls, uploads, and download buttons. Local script changes do not change remote account settings. See [ad placement policies](https://support.google.com/adsense/answer/1346295?hl=en).
6. Confirm Privacy matches the actual hosting and advertising services. Where Google's consent requirements apply, configure the required certified consent management platform through the account before serving affected ads. Cozy Fit's disabled-ad settings panel is not a site-wide CMP. See [privacy disclosures](https://support.google.com/publisherpolicies/answer/10437794?hl=en) and [certified CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en).
7. Confirm the support mailbox works and you have permission to publish all game code, libraries, images, and other assets. This review does not establish asset ownership.
8. Once the changes are live and the account's stated issues are resolved, request review in AdSense. There is no invented waiting period or word-count target to meet.

## Keeping content useful

Keep guides aligned with actual controls as games change. Add material when it helps visitors solve a specific problem. Fix broken interactions and confusing claims before adding more pages. Avoid duplicated filler, simulated ads, and review-only pages hidden from normal navigation.
