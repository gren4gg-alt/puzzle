/* ==========================================================================
   level.js — test level: all synced entity types, including the three
   co-op puzzle mechanics, as independently-testable zones
   --------------------------------------------------------------------------
   This is the seam where the real level module from the level-design chat
   plugs in. It only has to satisfy two things:

     1. build(world, netWorld) constructs entities in a FIXED, deterministic
        order, pushing:
          - boxes      into netWorld.boxes
          - platforms  into netWorld.platforms — this now includes every
            kinematic, path-following body: MovingPlatform, LinkedDoor, and
            each half (.left/.right) of a Seesaw. All three share the exact
            same sync contract (a position that moves over time), so they
            share one array and one wire format — see netcode.js's Codec
            for why a door's open/closed state needs no separate field.
          - plates     into netWorld.plates — PressurePlate only. This is
            the one new thing a client can't infer on its own (whether
            something is resting on a plate depends on physics the client
            never runs), so it gets its own small synced field.
        Array index == network id for each category, so host and client
        agree on which entity is which without ever sending an id table.
        Randomised or conditional construction order will silently desync
        everything.

     2. spawnPoint(slot) is a pure function of slot.

   ZONE LAYOUT — four independently-testable rooms in one continuous level,
   connected by short flat corridors so a real multiplayer session can walk
   between them. Zone 0 is the original box/platform/one-way/wind sanity
   zone. Zones A/B/C are direct translations of the physics chat's own
   proven, isolated test scenes (17+13+20 passing checks respectively) —
   same relative geometry, just placed side by side instead of tabbed, so
   nothing about the tuning (jump apex, boost reach, tilt rate) is
   re-guessed here.

     Zone 0 (x:    0- 960) — original sanity zone: boxes, platforms,
                              one-way platforms, wind zone
     Zone A (x: 1020-1980) — button hold-and-go: two plates, one door
     Zone B (x: 2040-3000) — boost-stacking gate: no new entities, just a
                              ledge only reachable by standing on a partner
     Zone C (x: 3060-4020) — seesaw: two weight-sensitive platforms
     Zone D (x: 4080-4680) — death + room reset: walk into the hazard
                              strip, everyone snaps back to spawn together
     Zone E (x: 4740-5380) — win condition + generic entity types: a goal
                              TriggerZone (mode:'any'), a ProjectileSpawner
                              arrow trap to exercise the dynamic-lifecycle
                              sync path end to end

   Nothing else in the level is replicated — static geometry never moves,
   so it costs zero bandwidth.
   ========================================================================== */
(function () {
"use strict";

const {
  StaticBody, OneWayPlatform, MovingPlatform, Box, WindZone,
  PressurePlate, LinkedDoor, Seesaw, Hazard, TriggerZone, ProjectileSpawner,
} = window.Engine;

const H = 540;
const W = 5400;   // 0-960 zone0, 1020-1980 zoneA, 2040-3000 zoneB, 3060-4020 zoneC,
                   // 4080-4680 zoneD, 4740-5380 zoneE, +20 outer wall

window.Level = {
  WIDTH: W,
  HEIGHT: H,

  spawnPoint(slot) {
    // Spawns into zone 0. A real level's spawn logic replaces this; this
    // only needs to be a pure function of slot and land somewhere valid.
    return { x: 90 + (slot % 6) * 46, y: 300 - Math.floor(slot / 6) * 60 };
  },

  build(world, nw) {
    const FLOOR_Y = H - 40; // 500 — shared floor top across every zone

    /* ---------------- outer boundary (only at the very ends) ---------------- */
    world.add(new StaticBody(0, 0, 20, H));       // far left wall

    /* ==================== ZONE 0 — original sanity zone ==================== */
    world.add(new StaticBody(0, FLOOR_Y, 960, 40));
    world.add(new StaticBody(300, FLOOR_Y - 110, 120, 20));   // ledge
    world.add(new StaticBody(640, FLOOR_Y - 200, 140, 20));   // high ledge

    world.add(new OneWayPlatform(180, FLOOR_Y - 190, 120, 12));
    world.add(new OneWayPlatform(460, FLOOR_Y - 290, 120, 12));

    world.add(new WindZone(800, FLOOR_Y - 160, 120, 160, -260, 0, 420));

    nw.platforms.push(world.add(new MovingPlatform(
      420, FLOOR_Y - 80, 110, 18,
      [{ x: 420, y: FLOOR_Y - 80 }, { x: 420, y: FLOOR_Y - 260 }], 70, 'pingpong'
    )));
    nw.platforms.push(world.add(new MovingPlatform(
      120, FLOOR_Y - 380, 100, 16,
      [{ x: 120, y: FLOOR_Y - 380 }, { x: 520, y: FLOOR_Y - 380 }], 90, 'pingpong', true
    )));

    nw.boxes.push(world.add(new Box(340, FLOOR_Y - 150, 34, 34)));
    nw.boxes.push(world.add(new Box(700, FLOOR_Y - 240, 34, 34)));
    nw.boxes.push(world.add(new Box(560, FLOOR_Y - 40,  34, 34)));
    nw.boxes.push(world.add(new Box(600, FLOOR_Y - 40,  34, 34)));

    /* ============ connector 0->A ============ */
    world.add(new StaticBody(960, FLOOR_Y, 60, 40));

    /* ============== ZONE A — button hold-and-go (plate + door) ==============
       Direct translation of the physics chat's "plate" scene (BASE_A=1020).
       Floor is split into three segments with two flush notches so each
       plate's top sits exactly level with the floor either side — the
       engine has no step-up, so a raised lip would block walking. Both
       gaps are exactly plate-width, and each plate is itself a normal
       solid whose top aligns with the floor top, so nothing falls through
       underneath it; the plate IS the ground at that x-range. */
    const BASE_A = 1020;
    world.add(new StaticBody(BASE_A + 0,   FLOOR_Y, 240, 40));
    const plateA = new PressurePlate(BASE_A + 240, FLOOR_Y, 100, 12, ['doorA'], true);   // accepts boxes
    world.add(plateA);
    nw.plates.push(plateA);

    world.add(new StaticBody(BASE_A + 340, FLOOR_Y, 180, 40));
    const plateB = new PressurePlate(BASE_A + 520, FLOOR_Y, 100, 12, ['doorA'], false);  // players only
    world.add(plateB);
    nw.plates.push(plateB);

    world.add(new StaticBody(BASE_A + 620, FLOOR_Y, 340, 40));

    nw.platforms.push(world.add(new LinkedDoor(
      'doorA', BASE_A + 780, FLOOR_Y - 140, 26, 140, { x: 0, y: -150 }, 220
    )));

    nw.boxes.push(world.add(new Box(BASE_A + 160, FLOOR_Y - 40, 44, 44)));

    /* ============ connector A->B ============ */
    world.add(new StaticBody(1980, FLOOR_Y, 60, 40));

    /* ================ ZONE B — boost-stacking gate ================
       No new entities at all — a level-design gate, per the physics
       chat: a single jump clears ~92px, standing on a partner's head
       adds their body height, so ~132px is reachable together. The gold
       ledge sits 120px up (boost-only, impossible solo); a reference
       ledge sits ~200px up, out of reach even boosted, as a deliberate
       reference point. Both boost-stack sync and rendering already work
       with zero networking changes — a stacked player's position is just
       wherever the host's physics puts it, carried through the same
       per-player position channel every other player already uses. */
    const BASE_B = 2040;
    world.add(new StaticBody(BASE_B + 0, FLOOR_Y, 960, 40));
    const reachable = world.add(new StaticBody(BASE_B + 560, FLOOR_Y - 120, 220, 20));
    reachable.color = '#c9a24b';
    // Reference ledge, clearly out of reach even boosted (boost tops out
    // ~132px; this sits ~200px up). Given extra vertical clearance above
    // the reachable ledge — the source scene's original 20px gap is less
    // than player height (40px), so it left no room to fly under it on
    // approach; fine for a human eyeballing a static scene, but it turns
    // the decoy into an accidental wall for a straight jump path.
    world.add(new StaticBody(BASE_B + 560, FLOOR_Y - 200, 220, 10));

    /* ============ connector B->C ============ */
    world.add(new StaticBody(3000, FLOOR_Y, 60, 40));

    /* ==================== ZONE C — seesaw / weight platform ====================
       Direct translation of the physics chat's "seesaw" scene. Tilt eases
       toward its target server-side rather than snapping, so this needs
       no special client-side smoothing at all — it rides the same
       position-interpolation every other synced entity already gets. */
    const BASE_C = 3060;
    world.add(new StaticBody(BASE_C + 0, FLOOR_Y, 960, 40));

    const ssA = new Seesaw(BASE_C + 120, FLOOR_Y - 160, 300, 16,
      { maxRise: 46, tiltRate: 2.0, balanceWeight: 1 }).addTo(world);
    nw.platforms.push(ssA.left);
    nw.platforms.push(ssA.right);

    const ssB = new Seesaw(BASE_C + 560, FLOOR_Y - 160, 300, 16,
      { maxRise: 46, tiltRate: 2.0, balanceWeight: 3 }).addTo(world);
    nw.platforms.push(ssB.left);
    nw.platforms.push(ssB.right);

    const heavy = world.add(new Box(BASE_C + 600, FLOOR_Y - 240, 44, 44));
    heavy.weight = 3; heavy.color = '#8a4a2a';
    nw.boxes.push(heavy);
    nw.boxes.push(world.add(new Box(BASE_C + 200, FLOOR_Y - 260, 40, 40)));

    /* ============ connector C->D ============ */
    world.add(new StaticBody(4020, FLOOR_Y, 60, 40));

    /* ================ ZONE D — death + room reset ================
       A short hazard strip flush with the floor (same flush-notch pattern
       as the plates in zone A — the hazard IS the ground at that x-range,
       not a separate raised trigger sitting on top of it). Walking into
       it calls World.killPlayer() internally via the engine's own death
       pass; netcode.js is the one deciding WHEN to actually reset the
       room afterward (see CFG.RESET_DELAY_MS) — engine.js explicitly
       does not auto-reset, by design (see World.resetLevel's ownership
       comment). deathY is also set here as a defensive fallback so
       falling below the whole level kills too, not just this one strip —
       a level built without a floor gap anywhere still fails safely
       rather than letting a player fall forever. */
    const BASE_D = 4080;
    world.add(new StaticBody(BASE_D + 0, FLOOR_Y, 260, 40));
    const lava = world.add(new Hazard(BASE_D + 260, FLOOR_Y, 80, 40));
    lava.color = '#b34a3a';
    world.add(new StaticBody(BASE_D + 340, FLOOR_Y, 260, 40));

    nw.world.deathY = H + 400;

    // levelBounds clamps the camera (added by the physics chat's camera-
    // bound-movement feature — see World.enableCamera/Camera in
    // engine.js) so it never pans past the level's actual edges. maxY
    // deliberately extends past H (the visible screen height) to at
    // least deathY, NOT just H — this level has no literal floor gap
    // today (deathY here is a defensive fallback, per the comment
    // above), but if a future level DOES add one, a player needs to be
    // able to fall all the way down to deathY to actually die. If
    // levelBounds.maxY were only H, the camera's bottom boundary wall
    // would physically trap a falling player above deathY and they'd
    // never trigger the death — a real, verified softlock (confirmed:
    // player permanently stuck at the camera wall, un-dying, for a full
    // 10-second test). The +40 margin just keeps the clamp strictly
    // past deathY rather than exactly equal to it, so the death check's
    // strict `y > deathY` can actually fire before the wall would stop
    // them, not at the exact same instant.
    nw.world.levelBounds = { minX: 0, minY: 0, maxX: W, maxY: nw.world.deathY + 40 };

    // cameraOpts (added by the physics chat's camera-bound-movement
    // feature — see World.enableCamera/Camera in engine.js) lets each
    // level customize its own viewport: size, and which edges actually
    // block movement (only Players are ever blocked — boxes always pass
    // through the boundary freely, see solidsFor's isCameraWall check).
    // This level is content to use netcode.js's own fallback (960x540,
    // all edges blocking), so this is set explicitly here mainly as a
    // discoverable example for a future level that wants something
    // different — e.g. a tall vertical shaft level might want
    // { viewW: 540, viewH: 960 }, or a level that leans on fall-death
    // as its primary hazard might want { blockBottom: false } (see the
    // levelBounds.maxY comment above for why that specific interaction
    // needs care either way).
    nw.world.cameraOpts = { viewW: 960, viewH: 540 };

    /* ============ connector D->E ============ */
    world.add(new StaticBody(4680, FLOOR_Y, 60, 40));

    /* ================ ZONE E — win condition + new synced types ================
       Exercises both new registry entries at once: a goal TriggerZone
       (static lifecycle — position never moves, only touching/touchCount
       change) and a ProjectileSpawner's emitted arrows (dynamic lifecycle
       — created/destroyed at runtime, tracked by the host's own entity id
       since the client never runs the spawner logic that creates them).
       mode:'any' here — reaching the goal is a per-player race, not a
       "wait for everyone" gate; that's Zone E's own design choice, not
       something the win-condition system assumes generally. */
    const BASE_E = 4740;
    world.add(new StaticBody(BASE_E + 0, FLOOR_Y, 640, 40));

    nw.spawners.push(world.add(new ProjectileSpawner(BASE_E + 300, FLOOR_Y - 260, {
      vx: 0, vy: 240, interval: 1.6, phase: 0, kind: 'arrow',
    })));

    const goal = new TriggerZone(BASE_E + 560, FLOOR_Y - 60, 60, 60, { effect: 'goal' });
    world.add(goal);
    nw.triggers.push(goal);
    nw.winCondition = { type: 'reach-goal', mode: 'any', goals: [goal] };

    /* ---------------- far right wall (level's actual end) ---------------- */
    world.add(new StaticBody(W - 20, 0, 20, H));
  },
};

})();