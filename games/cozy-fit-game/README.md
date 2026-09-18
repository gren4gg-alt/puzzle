# Cozy Fit

A tactile browser packing puzzle inspired by colorful wooden fit-the-box toys.

## Run it

Open `index.html` in a modern browser. No build step, framework, package manager, or server is required.

For predictable local behavior, you can also run a tiny static server from this folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Core controls

- Touch/click and drag any piece from around the puzzle silhouette into the pale cells.
- Pieces magnetically snap when they fit.
- Grab any placed piece again to reposition it.
- Drag a placed piece outside the puzzle and release to remove it; `DROP TO REMOVE` appears and the piece bounces back to its parking spot.
- `R` rotates the selected piece from level 3 onward.
- `H` opens **Help**. Help runs a small exact-cover check against the player's current board:
  - if the current arrangement can still be solved, it highlights one safe next move;
  - if the current arrangement is a dead end, it tries removing placed pieces one at a time and highlights one that is blocking completion.
- `F` toggles full screen. The `⛶` button does the same thing.
- Sound and music can be toggled separately.
- Mouse, touch, stylus, and pointer input are supported.

## Current level pack

There are now 50 playable levels. Levels 1–2 teach the controls, level 3 unlocks rotation, and the later pack steadily introduces tighter silhouettes, larger five-cell pieces, holes, narrow corridors, and more opportunities for believable-but-wrong placements.

1. **Hello, Little Blocks!** — tutorial, four huge 2×2 blocks, no rotation.
2. **First Mix** — easy rectangle using corners, squares, and short bars, still no rotation.
3. **Arrow Garden** — arrow silhouette; rotation unlocks.
4. **Step by Step** — staircase silhouette and the first five-cell P piece.
5. **Plus One** — compact plus/cross with long bars and hooks.
6. **Pixel Diamond** — diamond silhouette with a W-shaped pentomino.
7. **Keyhole Club** — keyhole silhouette with two U-shaped pentominoes.
8. **U-Turn** — U-shaped board with an intentionally empty center and long dead-end traps.
9. **Heartbreaker** — cute heart silhouette with less-cute placement decisions.
10. **Crown Jewel** — first boss-style puzzle with crown teeth and multiple five-cell pieces.
11. **Lightning Lane** — narrow zig-zag board where rotation order matters.
12. **Rocket Pocket** — nose, fins, and tight side pockets.
13. **Hourglass Hustle** — a one-cell waist makes greedy placements dangerous.
14. **Pixel Star** — only six pieces, but the arms accept lots of tempting wrong fits.
15. **Snake Trail** — corridor-style packing with long pieces.
16. **Butterfly Effect** — twin wings connected by tight bridges and many small corners.
17. **Clover Trouble** — missing center plus bulky five-cell pieces.
18. **Moon Bite** — crescent silhouette with a restrictive inner curve.
19. **Cactus Jam** — branches create convincing dead ends.
20. **Spiral Trap** — inward corridor that can be sealed too early.
21. **Picture Frame** — hollow-center border puzzle.
22. **Trophy Room** — broad cup, narrow stem, and wide base.
23. **Castle Crunch** — ten pieces with roof notches and large wall sections.
24. **Robot Factory** — 46-cell body with split legs and tight gaps.
25. **Monster Mash** — current boss: ten mixed pieces packed into a playful monster silhouette.

## Shaped-board rendering

Masked-out cells are no longer covered by a large rectangular wooden floor. The board itself is now rendered as the playable silhouette: only active cells receive the thin wooden edge and pale sockets. This keeps arrows, diamonds, hearts, crowns, stairs, U-shapes, and future silhouettes visually clean.

## Level system / 50-level readiness

Each level defines its own `board` object and piece list in `game.js`:

- `cols` / `rows` define the level grid.
- `mask` uses `#` for playable cells and `.` for empty/non-board space.
- Every piece is a small cell-coordinate array, so the same engine supports dominoes, triominoes, tetrominoes, pentominoes, hooks, bars, U pieces, P pieces, W pieces, and future custom shapes.
- A canonical solved placement is stored with every piece, but the Help system does **not** simply label every non-canonical move as wrong. It first checks whether the player's actual partial arrangement still has a valid completion, so alternate valid solutions are allowed.

This is the mechanism foundation for the eventual 50-level pack; the current build now contains the full 50-level progression, with increasingly complex silhouettes and mixed 3/4/5-cell pieces.

## Included polish

- Pieces parked around the puzzle rather than below it
- Dynamic parking scale for long pieces
- Removable/repositionable placed pieces
- `DROP TO REMOVE` feedback
- Arbitrary board masks with silhouette-only rendering
- 3/4/5-cell piece variety
- Magnetic snap preview
- Exact-cover Help / dead-end detection
- Springy piece movement and removal pop
- Touch-first dragging with pointer capture
- Full-screen button plus `F` shortcut
- Animated tutorial hand and glowing target
- Procedural Web Audio sound effects and gentle music
- Mascot reactions
- Completion confetti
- Local best-time storage
- Responsive mobile layout
- Reduced-motion support


## Selection & mobile controls

- Click or tap a piece once to select it. The selected piece stays visibly outlined.
- Click or tap the same piece again to deselect it. Selecting a different piece moves the selection.
- Dragging begins only after a small movement threshold, so normal taps do not make pieces jump.
- Touch uses a slightly larger drag threshold to avoid accidental movement from finger jitter.
- On narrow phone layouts, Rotate and Help controls are moved ahead of the mascot so gameplay controls are easier to reach.

## Home / level map

- The game now opens on a dedicated **Cozy Trail** home screen instead of dropping straight into a puzzle.
- The 50 levels are shown as a winding map with ten themed zones.
- Progress unlocks sequentially: clearing a level opens the next stop.
- Completed levels stay replayable from the map and are marked with a green check.
- The newest/highest unlocked level glows and carries a **YOU ARE HERE** pointer.
- Whenever the home screen opens, its scroll position automatically centers the map on that highest unlocked level.
- A large **Continue** button starts the highest unlocked level immediately.
- The home icon and Cozy Fit logo return to the map from gameplay.
- Progress is saved in local storage under `cozy-fit-highest-level`. Older saves are upgraded automatically from the existing best-time records.

## Visual refresh (v8)
The board now uses a pale maple/birch toy-tray treatment with cream recessed slots and sculpted silhouette edges. Puzzle pieces use a candy-toy palette, fused cell bridges, chunky bevels, glossy highlights, soft depth, and occasional kawaii faces. Controls, mascot, map, and mobile styling were warmed up to match while keeping all existing mechanics and progression intact.

## Smooth-piece visual pass
- Puzzle pieces are now rendered as one continuous rounded polyomino silhouette instead of separate raised cells.
- Internal seams, per-cell bevels, and cell-by-cell gloss were removed.
- Selection, help, ejection, and touch feedback now apply to the whole piece contour.

## Smooth board visual pass

The puzzle board now follows the same smooth molded-toy language as the pieces: a continuous cream inset, a soft two-layer maple rim, no individual raised slot tiles, no wood-grain noise, and only very faint alignment guides so the shape stays readable without looking segmented.

### Board edge refinement
The board outline is now traced as continuous closed SVG paths instead of many short rounded edge segments. This removes the pipe/sausage-like joins at corners while preserving the shaped-board mechanic, holes, touch controls, help system, and all 25 levels.

## Monetization integration

The build now includes `ads-config.js` and `ad-manager.js` for a split monetization path: AdSense on the hosted web game and AdMob in a Capacitor native build. Native AdMob uses UMP consent before requesting ads, shows a home/map adaptive banner, hides the banner during gameplay, preloads interstitials, and only offers an interstitial at a between-level transition after the configured win/cooldown thresholds. Web AdSense has a responsive home/map slot plus an optional H5 Games Ad Placement API hook that stays disabled until the AdSense account has H5 Games Ads approval.

The default configuration is deliberately safe for development: `testMode` is on, native uses Google's demo ad units, and web AdSense makes no request until a publisher ID + display slot are supplied. See `CAPACITOR_ADS_SETUP.md` before shipping.

## Settings & privacy center (v11)

A gear button now opens a touch-friendly Settings panel from both the map and gameplay screens. It includes persistent Sound effects, Background music, Reduce motion, and Full screen controls. The same panel is also the player-facing privacy center: it explains where ads can appear, identifies the active Google ad service, shows consent/privacy readiness, opens Google's privacy-options form when available, and links to the game's public Privacy Policy / Terms / support details when configured.

Player-facing legal links are configured in `ads-config.js` with `privacyPolicyUrl`, `termsUrl`, `supportEmail`, and `appVersion`. Sound, music, and reduce-motion preferences are stored locally on the device/browser.


## Levels 26–50 (v12)

The second half adds five new map zones — **Wonder Woods, Critter Cove, Hero Hills, Star Station, and Final Realm** — with 25 new silhouette puzzles: fish, mushroom, ghost, anchor, pine tree, paw, turtle, dragonfly, teacup, music note, shield, sword, mountain, snowflake, temple, UFO, satellite, planet, comet, space invader, skull, dragon, maze, cat, and the final boss. Returning players who had already cleared the old Level 25 are automatically promoted to Level 26.
