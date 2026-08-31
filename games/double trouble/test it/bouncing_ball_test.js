global.window = {};
require('./engine.js');
const { World, StaticBody, Player, BouncingBall, PHYSICS } = window.Engine;
function check(n,c,i){ console.log((c?'OK  ':'FAIL'),n,c?'':('- '+i)); if(!c)process.exitCode=1; }
const NONE={left:false,right:false,jump:false,action:false};

// ---- 1. Ball moves in an arbitrary 2D direction (both vx and vy) ----
{
  const w = new World();
  const ball = w.add(new BouncingBall(100,100,20,20,{vx:150,vy:-80,friction:0,bounds:{minX:0,minY:0,maxX:2000,maxY:2000}}));
  for (let i=0;i<30;i++) w.step(1/60);
  check('ball moved on X', ball.x > 100, 'x='+ball.x.toFixed(1));
  check('ball moved on Y (both components independent, not just launch-and-fall)', ball.y < 100,
    'y='+ball.y.toFixed(1));
}

// ---- 2. Reflects off all 4 walls (bounds-rect mode), keeps going indefinitely ----
{
  const w = new World();
  const b = {minX:0,minY:0,maxX:300,maxY:300};
  const ball = w.add(new BouncingBall(140,140,20,20,{vx:200,vy:200,friction:0,minSpeed:200,bounds:b}));
  let hitLeft=false,hitRight=false,hitTop=false,hitBottom=false;
  for (let i=0;i<2000;i++){
    w.step(1/60);
    if (ball.x <= b.minX+0.5) hitLeft=true;
    if (ball.x+ball.w >= b.maxX-0.5) hitRight=true;
    if (ball.y <= b.minY+0.5) hitTop=true;
    if (ball.y+ball.h >= b.maxY-0.5) hitBottom=true;
    check;
  }
  check('reflected off left wall at some point', hitLeft, '');
  check('reflected off right wall at some point', hitRight, '');
  check('reflected off top wall at some point', hitTop, '');
  check('reflected off bottom wall at some point', hitBottom, '');
  check('ball never left the bounds rect (hard containment)',
    ball.x >= b.minX-0.5 && ball.x+ball.w <= b.maxX+0.5 && ball.y >= b.minY-0.5 && ball.y+ball.h <= b.maxY+0.5,
    'x='+ball.x.toFixed(1)+' y='+ball.y.toFixed(1));
  check('still moving after 2000 frames (never despawned, never stopped)',
    Math.hypot(ball.vx,ball.vy) > 0, '');
  check('ball entity was never removed from the world', w.entities.includes(ball), '');
}

// ---- 3. Reflection actually flips the correct velocity component ----
{
  const w = new World();
  const b = {minX:0,minY:0,maxX:100,maxY:1000};
  const ball = w.add(new BouncingBall(80,50,20,20,{vx:100,vy:0,friction:0,bounds:b}));
  const vyBefore = ball.vy;
  for (let i=0;i<10;i++) w.step(1/60); // should hit the right wall (x:80->100) quickly
  check('hitting the RIGHT wall flips vx (was positive, now negative)', ball.vx < 0, 'vx='+ball.vx.toFixed(1));
  check('hitting the right wall does NOT touch vy', ball.vy === vyBefore, 'vy='+ball.vy);
}

// ---- 4. Friction decelerates speed, preserving direction ----
{
  const w = new World();
  const ball = w.add(new BouncingBall(500,500,20,20,{vx:300,vy:400,friction:100,minSpeed:0.001,bounds:{minX:0,minY:0,maxX:5000,maxY:5000}}));
  const initialAngle = Math.atan2(ball.vy, ball.vx);
  const initialSpeed = Math.hypot(ball.vx, ball.vy);
  for (let i=0;i<30;i++) w.step(1/60);
  const newSpeed = Math.hypot(ball.vx, ball.vy);
  const newAngle = Math.atan2(ball.vy, ball.vx);
  check('friction reduces speed over time', newSpeed < initialSpeed, 'initial='+initialSpeed.toFixed(1)+' now='+newSpeed.toFixed(1));
  check('friction preserves direction (angle unchanged)', Math.abs(newAngle-initialAngle) < 0.001,
    'initialAngle='+initialAngle.toFixed(4)+' newAngle='+newAngle.toFixed(4));
}

// ---- 5. Friction floors at minSpeed, never fully stops ----
{
  const w = new World();
  const ball = w.add(new BouncingBall(500,500,20,20,{vx:300,vy:0,friction:500,minSpeed:60,bounds:{minX:0,minY:0,maxX:5000,maxY:5000}}));
  for (let i=0;i<600;i++) w.step(1/60); // 10s, plenty of time to decay fully if unfloored
  const finalSpeed = Math.hypot(ball.vx, ball.vy);
  check('speed floors at minSpeed, never reaches 0', finalSpeed >= 59 && finalSpeed <= 61,
    'finalSpeed='+finalSpeed.toFixed(2)+' expected~60');
  check('ball is still actually moving (never a fully dead hazard)', finalSpeed > 0, '');
}

// ---- 6. Friction and minSpeed are per-ball tunable (config wins over defaults) ----
{
  const w = new World();
  const fast = w.add(new BouncingBall(0,0,20,20,{vx:1000,vy:0,friction:10,bounds:{minX:-10000,minY:-10000,maxX:10000,maxY:10000}}));
  const slow = w.add(new BouncingBall(0,0,20,20,{vx:1000,vy:0,friction:800,bounds:{minX:-10000,minY:-10000,maxX:10000,maxY:10000}}));
  for (let i=0;i<20;i++) w.step(1/60);
  check('different friction values on different balls decay independently',
    Math.abs(fast.vx) > Math.abs(slow.vx), 'fast.vx='+fast.vx.toFixed(1)+' slow.vx='+slow.vx.toFixed(1));
}

// ---- 7. Config wins over PHYSICS defaults ----
{
  const ball = new BouncingBall(0,0,20,20,{friction:999});
  check('explicit friction overrides PHYSICS.BALL_DEFAULT_FRICTION', ball.friction===999, '');
  const ball2 = new BouncingBall(0,0,20,20,{});
  check('omitted friction falls back to PHYSICS.BALL_DEFAULT_FRICTION', ball2.friction===PHYSICS.BALL_DEFAULT_FRICTION, '');
}

// ---- 8. Kills players on contact ----
{
  const w = new World();
  const p = w.add(new Player(100,100));
  const ball = w.add(new BouncingBall(105,105,20,20,{vx:0,vy:0,friction:0,bounds:{minX:0,minY:0,maxX:2000,maxY:2000}}));
  for (let i=0;i<5;i++){ p.handleInput(NONE,1/60); w.step(1/60); }
  check('ball overlapping a player kills them', p.dead===true, '');
}

// ---- 9. killsPlayers:false is harmless ----
{
  const w = new World();
  const p = w.add(new Player(100,100));
  const ball = w.add(new BouncingBall(105,105,20,20,{vx:0,vy:0,friction:0,killsPlayers:false,bounds:{minX:0,minY:0,maxX:2000,maxY:2000}}));
  for (let i=0;i<5;i++){ p.handleInput(NONE,1/60); w.step(1/60); }
  check('killsPlayers:false never kills', p.dead===false, '');
}

// ---- 10. Geometry-fallback mode (no bounds rect) reflects off real solids ----
{
  const w = new World();
  w.add(new StaticBody(200,0,20,1000)); // a wall to the right
  const ball = w.add(new BouncingBall(150,100,20,20,{vx:200,vy:0,friction:0})); // no bounds -> geometry mode
  for (let i=0;i<40;i++) w.step(1/60);
  check('geometry-fallback mode reflects off a real StaticBody wall', ball.vx < 0, 'vx='+ball.vx.toFixed(1));
  check('ball does not tunnel through the wall', ball.x + ball.w <= 200.5, 'ball.right='+(ball.x+ball.w).toFixed(1));
}

// ---- 11. Determinism ----
{
  function run(){
    const w = new World();
    const ball = w.add(new BouncingBall(140,140,20,20,{vx:213,vy:-177,friction:40,bounds:{minX:0,minY:0,maxX:300,maxY:300}}));
    const out = [];
    for (let i=0;i<500;i++){ w.step(1/60); out.push(ball.x.toFixed(4)+','+ball.y.toFixed(4)+','+ball.vx.toFixed(4)+','+ball.vy.toFixed(4)); }
    return out.join('|');
  }
  const r1 = run(), r2 = run();
  check('two identical runs produce a bit-identical bounce trajectory', r1===r2, 'diverged');
}

// ---- 12. Deterministic even-spread launch angles (level's proposed formula) ----
{
  const BALL_COUNT = 5;
  const angles = [];
  for (let i=0;i<BALL_COUNT;i++) angles.push(i/BALL_COUNT*Math.PI*2);
  const w = new World();
  const balls = angles.map(a => w.add(new BouncingBall(150,150,16,16,{
    vx: Math.cos(a)*200, vy: Math.sin(a)*200, friction:0, bounds:{minX:0,minY:0,maxX:300,maxY:300}
  })));
  check('evenly-spaced angle formula produces distinct initial velocities',
    new Set(balls.map(b=>b.vx.toFixed(2)+','+b.vy.toFixed(2))).size === BALL_COUNT, '');
  // sanity: no Math.random anywhere in this path — re-running with the
  // same formula must reproduce identical velocities every time.
  const balls2 = angles.map(a => ({vx:Math.cos(a)*200, vy:Math.sin(a)*200}));
  check('formula is pure/deterministic — rebuilding gives identical velocities',
    balls.every((b,i)=>Math.abs(b.vx-balls2[i].vx)<1e-9 && Math.abs(b.vy-balls2[i].vy)<1e-9), '');
}

// ---- 13. Sync round-trip ----
{
  const w = new World();
  const ball = w.add(new BouncingBall(140,140,20,20,{vx:150,vy:-90,friction:40,bounds:{minX:0,minY:0,maxX:300,maxY:300}}));
  for (let i=0;i<50;i++) w.step(1/60);
  const snap = JSON.parse(JSON.stringify(ball.getSyncState()));
  const ball2 = new BouncingBall(0,0,20,20,{});
  ball2.applySyncState(snap);
  check('ball sync state round-trips exactly', ball2.x===ball.x && ball2.y===ball.y && ball2.vx===ball.vx && ball2.vy===ball.vy, '');
}

// ---- 14. Balls pass through each other (no ball-vs-ball collision) ----
{
  const w = new World();
  const a = w.add(new BouncingBall(100,100,20,20,{vx:100,vy:0,friction:0,bounds:{minX:0,minY:0,maxX:2000,maxY:2000}}));
  const b = w.add(new BouncingBall(300,100,20,20,{vx:-100,vy:0,friction:0,bounds:{minX:0,minY:0,maxX:2000,maxY:2000}}));
  for (let i=0;i<180;i++) w.step(1/60); // enough time for them to cross paths
  check('balls pass through each other without altering velocity on contact',
    Math.abs(a.vx)===100 && Math.abs(b.vx)===100, 'a.vx='+a.vx+' b.vx='+b.vx);
}

// ---- 15. resetLevel() restores a ball to its spawn position/velocity ----
{
  const w = new World();
  const ball = w.add(new BouncingBall(140,140,20,20,{vx:150,vy:-90,friction:0,bounds:{minX:0,minY:0,maxX:300,maxY:300}}));
  const spawnX=ball.x, spawnY=ball.y;
  for (let i=0;i<200;i++) w.step(1/60);
  check('ball moved from spawn during play', ball.x!==spawnX || ball.y!==spawnY, '');
  w.resetLevel();
  check('resetLevel restores ball position to spawn', ball.x===spawnX && ball.y===spawnY,
    'now=('+ball.x+','+ball.y+')');
}
console.log('\nDone.');
