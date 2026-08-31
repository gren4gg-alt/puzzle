global.window = {};
require('./engine.js');
const { World, StaticBody, TriggerZone, BouncingBall } = window.Engine;
require('./netcode.js');
const { Host, BTN, evaluateTurnMode, stateToMask } = window.Netcode;

function check(n,c,i){ console.log((c?'OK  ':'FAIL'),n,c?'':('- '+i)); if(!c)process.exitCode=1; }

// A minimal fake "input" driver: Host.step() reads this.input.getState()
// only for the SELF peer; other peers' masks are set directly on their
// fake peer record (p.mask), matching how real remote input arrives.
function fakeInput(stateRef) { return { getState: () => stateRef }; }
const NONE_STATE = { left:false, right:false, jump:false, action:false };

function setupRelayLevel(goalX) {
  window.Level = {
    WIDTH: 2000, HEIGHT: 540,
    spawnPoint: (slot) => ({ x: 100, y: 460 }),
    build: (world, nw) => {
      world.add(new StaticBody(0, 500, 2000, 40));
      const goal = world.add(new TriggerZone(goalX, 460, 60, 40, { effect: 'goal' }));
      nw.triggers.push(goal);
      nw.world.deathY = 2000;
      nw.turnMode = { type: 'relay', goal, invulnDuration: 0.5 };
    },
  };
}

function resetHost() {
  Host.nw = null; Host.tw = null;
  Host.peers = new Map(); Host.slots = new Map(); Host.used = new Set();
  Host.tick = 0; Host.started = false;
  Host.levelComplete = false;
  Host.locked = false; Host.chosenLevel = null;
  Host.pendingAcks = new Map();
  Host.selfId = 'p0';
  Host.onComplete = function(){};  // normally set by prepare(), which this test bypasses
  Host.onStatus = function(){};
}

function addFakePeer(peerId, slot) {
  Host.peers.set(peerId, { conn: null, mask: 0, progress: 0 });
  Host.slots.set(peerId, slot);
  Host.used.add(slot);
}

// =====================================================================
// 1. Only the FIRST queued player spawns at start(), rest are queued
// =====================================================================
{
  resetHost();
  setupRelayLevel(1000);
  addFakePeer('p0', 0); addFakePeer('p1', 1); addFakePeer('p2', 2);
  Host.lock(0);
  Host.start(null, fakeInput(NONE_STATE), ()=>{}, ()=>{});

  check('exactly one player spawned at start (relay mode)', Host.nw.players.size===1,
    'players.size='+Host.nw.players.size);
  check('the spawned player is slot 0 (first in join order)', Host.nw.players.has(0), '');
  check('slots 1 and 2 are queued, not spawned', !Host.nw.players.has(1) && !Host.nw.players.has(2), '');
  check('turnQueue holds the remaining two slots in order', 
    Host.nw.turnQueue.length===2 && Host.nw.turnQueue[0]===1 && Host.nw.turnQueue[1]===2,
    JSON.stringify(Host.nw.turnQueue));
  check('turnActiveSlot is 0', Host.nw.turnActiveSlot===0, '');
  check('active player granted invulnerability on spawn', Host.nw.players.get(0).invulnerableTimer===0.5, '');
}

// =====================================================================
// 2. Reaching the goal clears the active player and spawns the next,
//    with a fresh invulnerability grant
// =====================================================================
{
  resetHost();
  setupRelayLevel(300); // close enough to walk to quickly
  addFakePeer('p0', 0); addFakePeer('p1', 1);
  Host.lock(0);
  Host.start(null, fakeInput(NONE_STATE), ()=>{}, ()=>{});

  const p0 = Host.nw.players.get(0);
  check('player 0 active', !!p0, '');

  // drive player 0 rightward toward the goal via the real input path
  const rightState = { left:false, right:true, jump:false, action:false };
  const selfInput = fakeInput(rightState);
  Host.input = selfInput;
  let cleared = false;
  for (let i=0;i<400;i++){
    Host.step();
    if (!Host.nw.players.has(0)) { cleared = true; break; }
  }
  check('player 0 cleared (removed) after reaching the goal', cleared, '');
  check('slot 1 auto-spawned as the next turn', Host.nw.players.has(1), '');
  check('turnQueue is now empty', Host.nw.turnQueue.length===0, '');
  check('turnActiveSlot advanced to 1', Host.nw.turnActiveSlot===1, '');
  check('newly-spawned player 1 granted fresh invulnerability', 
    Host.nw.players.get(1).invulnerableTimer===0.5, 'timer='+Host.nw.players.get(1).invulnerableTimer);
  check('turnClearedSlots records slot 0', Host.nw.turnClearedSlots.has(0), '');
  check('level not yet complete (slot 1 still has their turn)', Host.levelComplete===false, '');
}

// =====================================================================
// 3. Last player clearing completes the level (via completeLevel, even
//    though earlier players' entities are long gone from nw.players)
// =====================================================================
{
  resetHost();
  setupRelayLevel(300);
  addFakePeer('p0', 0); addFakePeer('p1', 1);
  Host.lock(0);
  const rightState = { left:false, right:true, jump:false, action:false };
  Host.start(null, fakeInput(rightState), ()=>{}, ()=>{});
  // Host.step() only reads this.input for the selfId peer ('p0'); every
  // OTHER peer's movement comes from their own p.mask field (how real
  // remote input arrives). Drive p1's mask directly so it walks once
  // it's spawned as the active turn.
  Host.peers.get('p1').mask = stateToMask(rightState);

  let steps = 0;
  while (!Host.levelComplete && steps < 1500) { Host.step(); steps++; }
  check('level completes once every queued player has cleared', Host.levelComplete===true, 'steps='+steps);
  check('both slots credited with progress (mode:all generalization)',
    Host.peers.get('p0').progress > 0 && Host.peers.get('p1').progress > 0,
    'p0.progress='+Host.peers.get('p0').progress+' p1.progress='+Host.peers.get('p1').progress);
  check('turnClearedSlots recorded both', Host.nw.turnClearedSlots.has(0) && Host.nw.turnClearedSlots.has(1), '');
}

// =====================================================================
// 4. A queued (not-yet-active) player disconnecting doesn't break the relay
// =====================================================================
{
  resetHost();
  setupRelayLevel(1000);
  addFakePeer('p0', 0); addFakePeer('p1', 1); addFakePeer('p2', 2);
  Host.lock(0);
  Host.start(null, fakeInput(NONE_STATE), ()=>{}, ()=>{});
  check('3 slots, player 0 active, 1&2 queued (sanity)', Host.nw.turnQueue.length===2, '');

  Host.drop('p1'); // slot 1 disconnects while queued, not yet their turn
  check('disconnected queued slot removed from turnQueue', !Host.nw.turnQueue.includes(1), '');
  check('remaining queued slot (2) still present', Host.nw.turnQueue.includes(2), '');
  check('active player (slot 0) unaffected by an unrelated disconnect', Host.nw.turnActiveSlot===0, '');
}

// =====================================================================
// 5. The ACTIVE player disconnecting advances the turn immediately
// =====================================================================
{
  resetHost();
  setupRelayLevel(1000);
  addFakePeer('p0', 0); addFakePeer('p1', 1);
  Host.lock(0);
  Host.start(null, fakeInput(NONE_STATE), ()=>{}, ()=>{});
  check('slot 0 active (sanity)', Host.nw.turnActiveSlot===0, '');

  Host.drop('p0'); // the CURRENTLY ACTIVE player disconnects mid-turn
  check('relay advances past the disconnected active player', Host.nw.turnActiveSlot===1, '');
  check('slot 1 auto-spawned', Host.nw.players.has(1), '');
  check('disconnected slot 0 was NOT credited as cleared', !Host.nw.turnClearedSlots.has(0), '');
}

// =====================================================================
// 6. Last remaining active player disconnecting completes rather than
//    stalling the room forever
// =====================================================================
{
  resetHost();
  setupRelayLevel(1000);
  addFakePeer('p0', 0);
  Host.lock(0);
  Host.start(null, fakeInput(NONE_STATE), ()=>{}, ()=>{});
  Host.drop('p0'); // only player, disconnects mid-turn, queue is now empty
  check('room completes rather than stalling with no active player and an empty queue',
    Host.levelComplete===true, '');
}

// =====================================================================
// 7. Non-relay levels are completely unaffected (regression)
// =====================================================================
{
  resetHost();
  window.Level = {
    WIDTH: 2000, HEIGHT: 540,
    spawnPoint: (slot) => ({ x: 100 + slot*40, y: 460 }),
    build: (world, nw) => { world.add(new StaticBody(0,500,2000,40)); },
  };
  addFakePeer('p0', 0); addFakePeer('p1', 1); addFakePeer('p2', 2);
  Host.lock(0);
  Host.start(null, fakeInput(NONE_STATE), ()=>{}, ()=>{});
  check('non-relay level still spawns every slot at once', Host.nw.players.size===3, 'size='+Host.nw.players.size);
  check('no turnQueue/turnMode leaks into a level that never opts in',
    !Host.nw.turnMode, '');
}

// =====================================================================
// 8. evaluateTurnMode is pure — never mutates anything itself
// =====================================================================
{
  resetHost();
  setupRelayLevel(300);
  addFakePeer('p0', 0);
  Host.lock(0);
  Host.start(null, fakeInput(NONE_STATE), ()=>{}, ()=>{});
  const before = Host.nw.players.size;
  evaluateTurnMode(Host.nw); // called directly, not via Host.step()
  check('calling evaluateTurnMode() alone does not spawn/remove/mutate anything',
    Host.nw.players.size===before, '');
}

console.log('\nDone.');
