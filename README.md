# App Hub + 🧩 Photo Puzzle Exchange

This repo has two parts:

- **`index.html`** — a generalized **home page** that lists every app you
  publish, as cards. This is what visitors land on first.
- **`puzzle-exchange.html`** — the actual **Photo Puzzle Exchange** app,
  linked from the home page. It's kept in its own file on purpose: as you add
  more small apps, each one gets its own HTML file, and you just register it
  on the home page instead of merging everything into one giant file.

Live demo: `https://<your-username>.github.io/<your-repo>/`
(Photo Puzzle Exchange specifically: `https://<your-username>.github.io/<your-repo>/puzzle-exchange.html`)

---

## Photo Puzzle Exchange

A **100% client-side, serverless, database-free** photo puzzle game. One person
scrambles a photo into a puzzle and shares the image file directly (WhatsApp,
email, Drive, etc). The receiver uploads that same file and solves it —
no accounts, no backend, no database. The "answer key" travels **inside the
image file itself**. Once solved, the receiver can download the completed,
seamless image (no puzzle key embedded — the game is over at that point).

---

## How it works

- **Create mode:** upload a photo → pick a grid size → the app scrambles it on
  a `<canvas>` → click **Download & Share** to get a single PNG file.
- **Solve mode:** upload the scrambled PNG you received → the app detects the
  hidden answer key, slices the image into draggable pieces, and gives you a
  drag-and-drop board to solve it. Confetti fires on a correct solve.

The answer key (grid size + piece order) is embedded two ways for redundancy:

| Method | How | Robustness |
|---|---|---|
| **B — File Appending (primary)** | JSON key is appended as raw bytes after the PNG's end marker | Survives byte-exact transfers (Drive, email, AirDrop, WhatsApp **Document** mode) |
| **A — Pixel Steganography (fallback)** | Key is written into a 1–2px strip at the bottom of the image | Survives if pixels stay lossless even when trailing bytes are stripped |

⚠️ **Important:** if sharing via WhatsApp, send the downloaded file as a
**Document/File** (📎 → Document), not as a "Photo" — photo mode forces
recompression and resizing, which can destroy both embedding methods.

---

## Deploying to GitHub Pages

1. Create a new GitHub repository (or use an existing one).
2. Add **both** `index.html` and `puzzle-exchange.html` to the **root** of
   the repo — or to a `/docs` folder if you prefer that Pages source. They
   must sit side by side so the home page's links resolve correctly.
3. Commit and push:
   ```bash
   git init
   git add index.html puzzle-exchange.html README.md
   git commit -m "Add app hub + Photo Puzzle Exchange"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
4. In GitHub: **Settings → Pages**
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` and folder `/ (root)` (or `/docs` if you used that)
   - Save.
5. Wait 1–2 minutes, then visit:
   `https://<your-username>.github.io/<your-repo>/`

No build step, no dependencies to install — it's a single static HTML file
that pulls Tailwind and (optionally) AdSense from CDNs at runtime.

---

## Before going live: things to configure

### 1. Google AdSense
Search `ca-pub-XXXXXXXXXXXXXXXX` in `index.html` and replace every instance
with your real AdSense publisher ID. Also replace the `data-ad-slot` values
(`1111111111`, `2222222222`) with your real ad unit slot IDs from your
AdSense account. There's a top banner and a bottom banner already wired up.

> Note: AdSense requires your domain (your GitHub Pages URL) to be added and
> approved in your AdSense account before ads will actually render — until
> then the slots will just render blank.

### 2. Rewarded video ad (download gate)
The **Download & Share** button currently opens a *simulated* 5-second
rewarded-ad modal before releasing the file. Find `#adVideoSlot` in
`index.html` and swap the placeholder `<div>` for your real ad SDK call
(e.g. Google Ad Manager rewarded web ads / AdMob for Web). The
`showRewardedAd(callback)` function is where the timer logic lives if you
want to change the required watch time or make it skippable sooner.

### 3. Adding new apps to the home page
Open `index.html` and edit the `APPS` array near the bottom of the `<script>`
block:
```js
const APPS = [
  {
    name: "Photo Puzzle Exchange",
    url: "puzzle-exchange.html",
    tag: "Game",
    emoji: "🧩",
    description: "..."
  },
  // add a new object here for each new app, pointing url at its own .html file
];
```
Each app should live in its own HTML file next to `index.html` — just like
`puzzle-exchange.html`. The Photo Puzzle Exchange app itself links back to
`index.html` via the **All apps** button in its header.

---

## Local testing

Just open `index.html` directly in a browser — no server required. (Some
browsers restrict `file://` canvas operations in edge cases; if you hit
issues, serve it locally instead:)

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

## Tech stack

- Vanilla HTML/CSS/JS — no build tools, no frameworks
- Tailwind CSS via CDN
- HTML5 Canvas for image slicing, shuffling, and pixel-level encoding
- Pointer Events API for mouse + touch drag-and-drop
- Google AdSense (banner) + a rewarded-ad-style download gate

## License

Add your preferred license here (MIT recommended for a project like this).
