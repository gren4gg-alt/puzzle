/* ══════════════════════════════════════════════════════════
   MOMO — the RAGEBAIT mascot: an original round cloud-cat creature.
   Split out from engine.js so her animation/rendering can be iterated
   on independently of the core physics/render loop.

   Depends on globals/functions from engine.js: player, entering, MAX_VX,
   scale, ctx, roundRect(), window.MOMO_AURA, and the module-level Momo
   gradient caches (_momoAuraGrad/_momoAuraKey/_momoBodyGrad/_momoBodyKey)
   which remain declared in engine.js.

   Load order in each level HTML: engine.js first, then momo.js — momo.js
   only defines functions that engine.js calls (updateMomoAnim, drawMomo);
   it doesn't need to run before engine.js's own top-level code.
   ══════════════════════════════════════════════════════════ */

function ensureAnimState(p){
  if(p._animInit) return;
  p._animInit=true;
  p.tailAngle=0; p.tailVel=0;
  p.earAngle=0;  p.earVel=0;
  p.bodyTilt=0;  p.bodyTiltVel=0;
  p.eyeSquint=0;
  p.airTime=0;   p.idleT=0;
  p.enterScale=1; p.enterSpin=0;
}

function updateMomoAnim(t){
  if(!player) return;
  ensureAnimState(player);
  const p=player;
  const grounded=p.onGround;
  // Normalized -1..1 speed fraction (of her top run speed) rather than a
  // raw pixel value — keeps every rotation below intrinsically bounded no
  // matter what MAX_VX or the viewport scale happen to be.
  const spdSigned=Math.max(-1,Math.min(1,p.vx/(MAX_VX*scale)));
  const spdN=Math.abs(spdSigned);
  const fallingFast = !grounded && p.vy> 2*scale;
  const risingFast  = !grounded && p.vy<-2*scale;

  p.airTime = grounded ? 0 : p.airTime+1;
  p.idleT   = (grounded && spdN<0.08 && !entering) ? p.idleT+1 : 0;

  // tail: trails opposite her travel, rises like it's catching air the
  // longer she falls, whips backward hard on takeoff, curls forward on
  // landing impact, sways gently on its own when she's just standing.
  let tailTarget = -spdSigned*0.5;
  tailTarget += Math.min(1,p.airTime/14) * (fallingFast?0.4:0);
  if(p.stretch>0.35) tailTarget -= p.facing*0.7;
  if(p.squash>0.35)  tailTarget += p.facing*0.4;
  if(p.idleT>0) tailTarget += Math.sin(p.idleT*0.045)*0.3;
  if(entering) tailTarget = p.facing*0.8;
  const TAIL_K=0.012, TAIL_D=0.82;
  p.tailVel = (p.tailVel + (tailTarget-p.tailAngle)*TAIL_K) * TAIL_D;
  p.tailAngle += p.tailVel;

  // ears: pin back with speed and the longer she's falling, perk up on
  // the way up, snap up sharply right on landing, twitch now and then
  // while idle.
  let earTarget = -spdN*0.32;
  if(fallingFast) earTarget -= Math.min(0.35,p.airTime*0.014);
  if(risingFast)  earTarget += 0.28;
  if(p.squash>0.45) earTarget += 0.38;
  if(p.idleT>55 && Math.floor(p.idleT/85)%2===0) earTarget += 0.10*Math.sin(p.idleT*0.05);
  if(entering) earTarget = -0.55;
  const EAR_K=0.05, EAR_D=0.72;
  p.earVel = (p.earVel + (earTarget-p.earAngle)*EAR_K) * EAR_D;
  p.earAngle += p.earVel;

  // body: leans into her speed, noses down the longer she's falling,
  // noses up a touch right at takeoff.
  let tiltTarget = spdSigned*0.14;
  if(fallingFast) tiltTarget += Math.min(0.14,p.airTime*0.005);
  if(risingFast)  tiltTarget -= 0.08;
  if(entering) tiltTarget = 0;
  const TILT_K=0.02, TILT_D=0.8;
  p.bodyTiltVel = (p.bodyTiltVel + (tiltTarget-p.bodyTilt)*TILT_K) * TILT_D;
  p.bodyTilt += p.bodyTiltVel;

  // eyes: narrow into a determined squint the longer she free-falls,
  // go wide right at the moment she launches.
  let squintTarget = fallingFast ? Math.min(0.6,p.airTime*0.02) : 0;
  if(p.stretch>0.5) squintTarget = -0.3;
  p.eyeSquint += (squintTarget-p.eyeSquint)*0.15;
}


/* Momo — an original round cloud-cat creature, drawn from primitives.
   `anim` (optional — pass the player object) supplies the physics-driven
   secondary motion from updateMomoAnim(): tailAngle/earAngle swing the
   tail and ears off her actual velocity and airtime, bodyTilt banks her
   into motion, eyeSquint narrows/widens her eyes, enterScale/enterSpin
   play the portal swirl-in. Every shape sits at the exact same rest
   coordinates as before when anim is omitted or all-zero — this is a
   superset of the original pose, not a redesign. */
function drawMomo(px,py,w,h,facing,squash,stretch,blinking,t,anim){
  anim=anim||{};
  const tailA=anim.tailAngle||0;
  const earA=anim.earAngle||0;
  const tilt=anim.bodyTilt||0;
  const squint=Math.max(-0.5,Math.min(0.7,anim.eyeSquint||0));
  const enterSc=(anim.enterScale===undefined)?1:anim.enterScale;
  const enterSp=anim.enterSpin||0;

  ctx.save();
  ctx.translate(px+w/2,py+h/2);
  ctx.rotate(tilt+enterSp);
  ctx.scale(enterSc,enterSc);
  ctx.scale(1+squash*0.22-stretch*0.14,1-squash*0.24+stretch*0.18);
  const s=scale;

  const auraCol=window.MOMO_AURA||'255,243,196';
  const aKey=w+'|'+auraCol;
  if(_momoAuraKey!==aKey){
    const aura=ctx.createRadialGradient(0,0,w*0.2,0,0,w*1.2);
    aura.addColorStop(0,`rgba(${auraCol},0.42)`);
    aura.addColorStop(1,`rgba(${auraCol},0)`);
    _momoAuraGrad=aura;_momoAuraKey=aKey;
  }
  ctx.fillStyle=_momoAuraGrad;ctx.beginPath();ctx.arc(0,0,w*1.2,0,Math.PI*2);ctx.fill();

  // ── ears: rotate about the scalp hinge. earA<0 pins them back (speed
  // / mid-fall), earA>0 perks them up (rising, just landed, idle twitch).
  // Coordinates below are the original triangle points re-expressed
  // relative to each ear's hinge, so at earA=0 this is pixel-identical
  // to the old static ears.
  ctx.save();
  ctx.translate(-w*0.10,-h*0.32);ctx.rotate(-earA);
  ctx.fillStyle='#ffe9a8';
  ctx.beginPath();ctx.moveTo(-w*0.26,h*0.02);ctx.lineTo(-w*0.10,-h*0.30);ctx.lineTo(w*0.04,0);ctx.closePath();ctx.fill();
  ctx.fillStyle='#ffb3a0';
  ctx.beginPath();ctx.moveTo(-w*0.18,-h*0.01);ctx.lineTo(-w*0.10,-h*0.20);ctx.lineTo(-w*0.03,-h*0.02);ctx.closePath();ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(w*0.10,-h*0.32);ctx.rotate(earA);
  ctx.fillStyle='#ffe9a8';
  ctx.beginPath();ctx.moveTo(w*0.26,h*0.02);ctx.lineTo(w*0.10,-h*0.30);ctx.lineTo(-w*0.04,0);ctx.closePath();ctx.fill();
  ctx.fillStyle='#ffb3a0';
  ctx.beginPath();ctx.moveTo(w*0.18,-h*0.01);ctx.lineTo(w*0.10,-h*0.20);ctx.lineTo(w*0.03,-h*0.02);ctx.closePath();ctx.fill();
  ctx.restore();

  if(_momoBodyKey!==String(h)){
    const body=ctx.createLinearGradient(0,-h/2,0,h/2);
    body.addColorStop(0,'#fffbe8');body.addColorStop(1,'#ffe4a3');
    _momoBodyGrad=body;_momoBodyKey=String(h);
  }
  ctx.fillStyle=_momoBodyGrad;
  ctx.beginPath();ctx.ellipse(0,1,w/2,h/2,0,0,Math.PI*2);ctx.fill();

  ctx.fillStyle='rgba(255,158,125,0.55)';
  ctx.beginPath();ctx.ellipse(-w*0.28,h*0.10,w*0.13,h*0.09,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(w*0.28,h*0.10,w*0.13,h*0.09,0,0,Math.PI*2);ctx.fill();

  const eo=(facing>=0?2.5:-2.5)*s;
  if(blinking){
    ctx.strokeStyle='#3a2450';ctx.lineWidth=2*s;ctx.lineCap='round';
    ctx.beginPath();ctx.arc(-w*0.17+eo,-h*0.06,3.2*s,Math.PI*1.15,Math.PI*1.85);ctx.stroke();
    ctx.beginPath();ctx.arc(w*0.17+eo,-h*0.06,3.2*s,Math.PI*1.15,Math.PI*1.85);ctx.stroke();
  }else{
    // squint>0 (falling) narrows the eyes into a determined line;
    // squint<0 (takeoff) widens them a touch, surprised by her own hop.
    const ry=3.7*s*(1-Math.max(0,squint)*0.55);
    const rx=3.1*s*(1+Math.max(0,-squint)*0.3);
    ctx.fillStyle='#3a2450';
    ctx.beginPath();ctx.ellipse(-w*0.17+eo,-h*0.06,rx,ry,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(w*0.17+eo,-h*0.06,rx,ry,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.95)';
    ctx.beginPath();ctx.arc(-w*0.17+eo+1.1*s,-h*0.10,1.15*s,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(w*0.17+eo+1.1*s,-h*0.10,1.15*s,0,Math.PI*2);ctx.fill();
  }

  ctx.strokeStyle='#3a2450';ctx.lineWidth=1.5*s;ctx.lineCap='round';
  ctx.beginPath();ctx.arc(eo*0.5,h*0.10,2.6*s,0.18*Math.PI,0.82*Math.PI);ctx.stroke();

  // ── tail: base pinned at the back of the body; tailA (spring-driven)
  // swings the whole curve like a pendulum, with the original idle
  // wiggle layered on top so it's never perfectly rigid mid-swing.
  // At tailA=0 this traces the exact same curve as before.
  ctx.save();
  const tx=facing>=0?-w*0.48:w*0.48,dirBase=facing>=0?-1:1;
  ctx.translate(tx,h*0.20);ctx.rotate(tailA);
  ctx.strokeStyle='#ffe4a3';ctx.lineWidth=3*s;ctx.lineCap='round';
  const wave=Math.sin(t*0.006)*2*s;
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.quadraticCurveTo(dirBase*7*s,h*0.14+wave,dirBase*2*s,h*0.26);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}