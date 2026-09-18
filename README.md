# Broshere

Static browser tools, games, and practical guides for https://broshere.com. No build step is required.

## Structure

- `index.html`: static home/tool directory.
- `puzzle-exchange.html`, `exam-photo-resizer.html`, `media-compressor.html`: tools, instructions, and troubleshooting.
- `games/gameindex.html`: game directory. Cozy Fit lives in `games/cozy-fit-game/`; existing game URLs are preserved.
- `guides/`: ten detailed guides and their library page.
- `assets/editorial.css`: shared navigation, footer, and reading styles.
- `about.html`, `contact.html`, `privacy.html`, `terms.html`: site information.
- `sitemap.xml`, `robots.txt`, `ads.txt`, `CNAME`: discovery and domain configuration.

`model-workbench.html` is the integrated 3D compression and conversion tool. Its generated sample, on-page instructions, and detailed guide help visitors compare formats, textures, geometry, and export limits. It is linked from the home page and included in validation and the sitemap.

## Local preview and checks

Serve this folder with `python -m http.server 8765 --bind 127.0.0.1`, then open http://127.0.0.1:8765/. Some pages fetch libraries, styles, or fonts externally; file processing runs in the browser.

With current Node.js:

```sh
node --experimental-vm-modules scripts/check-site.mjs
node scripts/check-cozy-levels.mjs
```

The first check validates local links, anchors, metadata presence, IDs, sitemap targets, and script syntax. The second verifies all 50 Cozy Fit stored solutions. Neither replaces browser testing.

## Editing content

Edit the static cards in the home or Games page; there is no JavaScript app registry. Keep guides specific to actual controls and behavior. Update directory links, related guides, canonical URLs, and sitemap together. Preserve old game URLs unless redirects are configured.

## Photo Puzzle Exchange

Create mode scrambles a photo into a PNG; Solve reads its embedded grid and piece order and creates a draggable board. The key is appended after the PNG end marker, with a pixel-strip fallback. This is puzzle metadata, not encryption. Share the original download as a file/document: resizing, screenshots, and photo recompression can destroy the key. A completed image download is an ordinary picture, not a new playable puzzle. Downloads are direct, with no ad timer or gate.

## Publishing

Publish the public root pages and entire `assets/`, `guides/`, and `games/` folders through the existing host. Exclude development scripts and documentation. Existing AdSense loaders on content pages and the publisher ID in `ads.txt` are preserved. Fullscreen game pages and new guides do not load automatic ads. Cozy Fit advertising is disabled globally in `ads-config.js`.

Read [ADSENSE-READINESS.md](ADSENSE-READINESS.md) for the work completed, testing limits, official references, and live checks. These local changes have not been deployed or submitted to Google.
