# Lobby / progression / level-select module

Owns everything between "players connect" and "everyone enters the level."
Hands off cleanly to the existing `engine.js` + `netcode.js` once a level starts.

## Files

| File | Purpose |
|---|---|
| `lobby.html` / `lobby.css` | Mobile-first UI: join/host screen, live lobby, persistent corner overlay, game mount point |
| `lobby.js` | The state machine — connection setup, lobby protocol client-side, rendering, start hand-off |
| `progress.js` | Per-device `localStorage` progress (levels completed), no accounts |
| `levels.js` | Level registry (index → name/script) + on-demand level script loader |
| `voicechat-adapter.js` | Thin interface wrapper + inert stub, since `voicechat.js` itself wasn't available to this chat |
| `netcode.js` | **Patched** — see "What changed in netcode.js" below |
| `engine.js` | Unchanged, included only so the demo runs standalone |

## State machine

```
join screen ──(host)──► Host.prepare()          [room open, lobby phase]
join screen ──(join)──► peer.connect(code)       [room open, lobby phase]
                              │
                    progress + level select
                    (Netcode.Host.recomputeLobby
                     is the sole source of truth)
                              │
                    host presses Start
                              │
                    Host.lock(level)   ← protocol-level join gate closes HERE
                              │
                    level script loaded (levels.js)
                              │
              Host.start() / Client.start()      [in-game, existing netcode.js]
```

## What changed in `netcode.js`

Everything below is additive to the `Host` object; `Client`, `Codec`,
`Validate`'s existing entries, and the whole snapshot/interpolation
pipeline are untouched.

- **`Host.prepare(peer, onStatus, opts)`** — now takes an optional third
  arg: `{ totalLevels, onLobby }`. `onLobby` is how the host's own UI gets
  lobby-state updates (same shape a client gets over the wire).
- **`Host.lock(level)`** *(new)* — the actual protocol-level start gate.
  Sets `this.locked = true` and reliably broadcasts `{type:'starting', level}`
  (via the existing `sendReliable`/ack machinery, same pattern as `welcome`).
  Called the instant the host presses Start, *before* the level is loaded.
- **`Host.onConn`** — now checks `this.locked` first and, if true, sends
  `{type:'rejected', reason:'started'}` and closes the connection instead of
  queuing or silently welcoming a late joiner. This is the actual
  enforcement point the spec asked for.
- **`Host.onData`** — while `!this.started`, now also routes
  `{type:'progress', v}` and `{type:'select', level}` from clients (see
  `Validate.progress` / `Validate.select`, also new). Falls through to the
  existing input-validation path once the game has started, unchanged.
- **`Host.recomputeLobby()` / `broadcastLobby()` / `lobbySnapshot()`**
  *(new)* — the host-authoritative unlock computation: `unlockedCount =
  min(every connected player's reported progress) + 1`, clamped to
  `totalLevels`. Broadcast on every change plus a 600 ms heartbeat
  (`CFG.LOBBY_HEARTBEAT_MS`) so a dropped packet self-heals without a
  separate ack-retry system.
- **`Host.reportProgress(v)` / `Host.selectLevel(level)`** *(new)* — the
  host's own lobby UI calls these directly (no network hop for itself,
  same pattern the file already uses for `mySlot`/input elsewhere).
- **`Host.sendWelcome`** — now includes `level: this.chosenLevel` so every
  client knows which level script to load before `Client.start()` builds
  the world.

### On "verified" progress

There's no server, so a client can still lie about its *own* number — that
part is unavoidable in this architecture and is called out explicitly in
`Validate.progress`'s comment. What the host DOES guarantee:

1. The value used is always a well-formed, in-range integer — never
   trusted as-is, never a client-computed "unlocked levels" list.
2. The host computes the group's unlock level itself, as `min()` across
   everyone connected — a lying client can raise the unlock ceiling at
   most to the true minimum of the honest players in the room, never
   beyond it, unless they're the only player.

If real anti-cheat matters later, that requires a server; this is the best
available in a fully static, serverless P2P design, and is a good match
for a co-op party game where the "attacker" is a friend spoiling their own
game.

## Integration points / assumptions for other chats

- **`window.InputManager`** (from `input.js`) is assumed to exist with a
  `.getState()` method, per netcode.js's own header comment. Not modified.
- **`window.Level`** contract (from `level.js`, owned by the level-design
  chat) — see the top of `levels.js` for the exact shape expected
  (`build(world, nw)`, `spawnPoint(slot)`). `levels.js` only needs an
  ordered list of `{id, name, src}` — append real level files there.
- **`window.VoiceChat`** — `voicechat.js` wasn't available to this chat,
  so `lobby.js` is written against the small interface documented at the
  top of `voicechat-adapter.js` (`init(peer, {getPeerIds})`, `mount(el)`,
  `setMuted(bool)`, `destroy()`). Load the real `voicechat.js` *before*
  `voicechat-adapter.js` in `lobby.html` and the adapter's stub steps
  aside automatically (`if (window.VoiceChat) return;`). If the real
  module's actual API differs, only the adapter needs to change.
- **Render loop** — `lobby.js`'s `startRenderLoop()`/`drawFrame()` at the
  bottom is a deliberately minimal stand-in (flat-colored rects) so the
  whole flow is demoable end-to-end. Swap `drawFrame()`'s body for the
  real renderer once merged; nothing above it (state machine, protocol,
  UI) needs to change for that swap.
- **Room codes** are just raw PeerJS peer IDs today (`new Peer()` with no
  explicit ID). If the existing join flow already has a nicer short-code
  scheme, swap it in at the two `new Peer(...)` call sites in `lobby.js`
  — nothing else depends on the code format.

## Testing notes

Two-tab local testing works the same way the networking chat has been
validating netcode.js: open `lobby.html` in two tabs/devices, host in one,
join with the displayed code in the other. `levels.js` ships three
placeholder entries (`levels/level0-tutorial.js` etc.) that don't exist
yet — point them at real files, or drop in trivial stub level scripts that
just call `window.Level = { build(){}, spawnPoint(){return {x:100,y:100};} }`
to smoke-test the lobby flow alone before real levels land.
