/* ============================================================
   engine.js — the game engine, shared by every level file.
   Physics, camera, collision, audio, pause/home/fullscreen,
   mobile viewport handling (incl. landscape zoom + control gutter),
   character + portal rendering, and the base starfield are ALL
   here and never duplicated per level.

   Each level HTML defines, before calling bootGame():
     LEVEL_ID, LEVEL_TITLE, winFlavorText(deaths)
     buildLevel(), updatePlatforms(t), drawPlatform(p,t)
   and optionally:
     window.SKY_THEME, buildExtraSky(), drawExtraScenery(t)
   ============================================================ */
const canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
const holder=document.getElementById('canvasHolder');
const overlay=document.getElementById('overlay'), pauseScreen=document.getElementById('pauseScreen');
const overlayTitle=document.getElementById('overlayTitle'), overlayText=document.getElementById('overlayText');
const controlHint=document.getElementById('controlHint'), startBtn=document.getElementById('startBtn');
const deathCountEl=document.getElementById('deathCount'), touchUI=document.getElementById('touch');
function loadProgress(){
  try{
    const raw=localStorage.getItem(PROGRESS_KEY);
    if(!raw) return {completed:{},unlocked:1};
    const p=JSON.parse(raw);
    return {completed:p.completed||{},unlocked:p.unlocked||1};
  }catch(e){ return {completed:{},unlocked:1}; }
}
function saveCompletion(levelId,deaths){
  const p=loadProgress();
  const idx=LEVEL_ORDER.indexOf(levelId);
  const prevBest=p.completed[levelId]&&p.completed[levelId].bestDeaths;
  p.completed[levelId]={bestDeaths:(prevBest===undefined?deaths:Math.min(prevBest,deaths)),lastPlayed:Date.now()};
  if(idx>=0) p.unlocked=Math.max(p.unlocked,Math.min(LEVEL_ORDER.length,idx+2));
  try{ localStorage.setItem(PROGRESS_KEY,JSON.stringify(p)); }catch(e){}
  return p;
}
function nextLevelId(){
  const idx=LEVEL_ORDER.indexOf(LEVEL_ID);
  if(idx<0||idx+1>=LEVEL_ORDER.length) return null;
  return LEVEL_ORDER[idx+1];
}

/* ══════════════════════════════════════════════════════════
   AUDIO — every sound is synthesized at runtime with the Web
   Audio API. No sampled or licensed files exist anywhere in
   this project, so the audio is original and free to use
   commercially with nothing to clear.
   ══════════════════════════════════════════════════════════ */
const Snd={
  ctx:null,master:null,musicGain:null,sfxGain:null,
  muted:false,musicTimer:null,step:0,
  init(){
    if(this.ctx)return;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    this.ctx=new AC();
    this.master=this.ctx.createGain();this.master.gain.value=0.9;
    this.master.connect(this.ctx.destination);
    this.sfxGain=this.ctx.createGain();this.sfxGain.gain.value=0.30;
    this.sfxGain.connect(this.master);
    this.musicGain=this.ctx.createGain();this.musicGain.gain.value=0.10;
    this.musicGain.connect(this.master);
  },
  resume(){if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume();},
  tone(freq,dur,type='sine',vol=1,slideTo=null,dest=null){
    if(!this.ctx||this.muted)return;
    const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);
    if(slideTo)o.frequency.exponentialRampToValueAtTime(Math.max(20,slideTo),t+dur);
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(vol,t+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g);g.connect(dest||this.sfxGain);
    o.start(t);o.stop(t+dur+0.03);
  },
  noise(dur,vol=0.5,filt=800){
    if(!this.ctx||this.muted)return;
    const t=this.ctx.currentTime,n=Math.floor(this.ctx.sampleRate*dur);
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const src=this.ctx.createBufferSource();src.buffer=buf;
    const f=this.ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=filt;
    const g=this.ctx.createGain();g.gain.value=vol;
    src.connect(f);f.connect(g);g.connect(this.sfxGain);
    src.start(t);
  },
  hop(){this.tone(430,0.16,'triangle',0.65,760);},
  land(){this.noise(0.09,0.28,520);this.tone(165,0.07,'sine',0.3);},
  fall(){this.tone(420,0.5,'sawtooth',0.3,90);},
  shrink(){this.tone(920,0.09,'square',0.11,620);},
  click(){this.tone(620,0.06,'square',0.18);},
  win(){[523.25,659.25,783.99,1046.5,1318.5].forEach((f,i)=>
    setTimeout(()=>this.tone(f,0.45,'triangle',0.45),i*95));},
  wobble(){
    // a queasy little warning warble — heads up, this platform's about to act up
    this.tone(300,0.18,'sawtooth',0.16,220);
    setTimeout(()=>this.tone(260,0.15,'sawtooth',0.14,180),90);
  },
  windGust(){this.noise(0.9,0.10,300);},
  glitch(){
    this.tone(180,0.22,'sawtooth',0.14,900);
    this.tone(1400,0.06,'square',0.06,220);
  },
  boing(){
    this.tone(220,0.24,'triangle',0.5,760);
    this.tone(440,0.10,'sine',0.2,880);
  },
  leafRustle(){this.noise(0.12,0.08,2200);},
  startWindPad(){
    if(!this.ctx||this.windSrc)return;
    const bufSec=4, n=Math.floor(this.ctx.sampleRate*bufSec);
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
    const src=this.ctx.createBufferSource();src.buffer=buf;src.loop=true;
    const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=500;f.Q.value=0.6;
    const g=this.ctx.createGain();g.gain.value=0.05;
    // slow filter sweep so the wind breathes instead of sitting static
    const lfo=this.ctx.createOscillator();lfo.frequency.value=0.07;
    const lfoGain=this.ctx.createGain();lfoGain.gain.value=220;
    lfo.connect(lfoGain);lfoGain.connect(f.frequency);
    src.connect(f);f.connect(g);g.connect(this.musicGain);
    src.start();lfo.start();
    this.windSrc=src;this.windLfo=lfo;
  },
  stopWindPad(){
    if(this.windSrc){try{this.windSrc.stop();}catch(e){}this.windSrc=null;}
    if(this.windLfo){try{this.windLfo.stop();}catch(e){}this.windLfo=null;}
  },
  startMusic(){
    if(!this.ctx||this.musicTimer)return;
    if(window.MUSIC_THEME==='mountain'){
      // Airy pentatonic melody (D major pentatonic) over a soft wind pad —
      // an original, unlicensed composition synthesized at runtime.
      const bass=[73.42,73.42,92.50,73.42,82.41,82.41,110.00,92.50];
      const lead=[293.66,329.63,369.99,440.00,493.88,440.00,369.99,329.63];
      this.startWindPad();
      this.step=0;
      this.musicTimer=setInterval(()=>{
        if(this.muted)return;
        const s=this.step%8;
        this.tone(bass[s],0.9,'sine',0.30,null,this.musicGain);
        if(s%2===0)this.tone(lead[s],1.1,'triangle',0.16,null,this.musicGain);
        this.step++;
      },520);
      return;
    }
    const bass=[110,110,146.83,110,130.81,130.81,164.81,146.83];
    const lead=[523.25,587.33,659.25,783.99,880,783.99,659.25,587.33];
    this.step=0;
    this.musicTimer=setInterval(()=>{
      if(this.muted)return;
      const s=this.step%8;
      this.tone(bass[s],0.5,'sine',0.5,null,this.musicGain);
      if(s%2===0)this.tone(lead[s],0.75,'triangle',0.2,null,this.musicGain);
      if(s===0||s===4)this.tone(bass[s]*2,0.3,'sine',0.13,null,this.musicGain);
      this.step++;
    },380);
  },
  stopMusic(){
    if(this.musicTimer){clearInterval(this.musicTimer);this.musicTimer=null;}
    this.stopWindPad();
  },
  toggleMute(){this.muted=!this.muted;if(this.master)this.master.gain.value=this.muted?0:0.9;return this.muted;}
};

const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
if(isTouch){touchUI.classList.add('on');controlHint.innerHTML='Tap <b>◀ ▶</b> to move &nbsp;·&nbsp; <b>HOP</b> to jump';}

let W,H,scale=1;          // W/H are VIRTUAL world dimensions
let SW=0,SH=0,zoom=1;     // SW/SH are the real canvas pixels; zoom maps between them
const MIN_VIEW_H=560;     // world height we always want visible
let UI_GUTTER=0, PLAY_H=0; // bottom strip reserved for touch controls
function resize(){
  SW=holder.clientWidth; SH=holder.clientHeight;
  const dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=SW*dpr; canvas.height=SH*dpr;
  canvas.style.width=SW+'px'; canvas.style.height=SH+'px';
  // On short screens (landscape phones) zoom the world out so a full jump
  // arc stays on screen instead of the character flying out of view.
  zoom = Math.min(1, SH/MIN_VIEW_H);
  W = SW/zoom; H = SH/zoom;              // everything else works in world units
  ctx.setTransform(dpr*zoom,0,0,dpr*zoom,0,0);
  scale=Math.min(1,Math.max(0.7,W/720));
  // Reserve a gutter at the bottom for the on-screen controls so the world
  // never renders underneath them (standard mobile "safe play area").
  // 118 screen px covers the 84px HOP button plus its padding + safe-area.
  UI_GUTTER = isTouch ? 118/zoom : 0;
  PLAY_H = H - UI_GUTTER;
}

// Debounced handler for real size/orientation changes. Mobile browsers fire
// several resize/orientationchange events in a row while the toolbar and
// safe-area settle, and the *last* one is the only reliable measurement —
// acting on an early one is what left the level sized for the old screen.
let resizeSettleTimer=null;
function handleViewportChange(){
  clearTimeout(resizeSettleTimer);
  resizeSettleTimer=setTimeout(()=>{
    resize();
    if(running){
      // The level was built for the previous screen size — its platform
      // positions, jump-reach caps, and portal are no longer guaranteed to
      // fit or be reachable at the new dimensions. Rebuild it fresh at the
      // new size rather than leaving the player stranded off-screen.
      const wasPaused=paused;
      cancelAnimationFrame(rafId);
      buildLevel();
      if(wasPaused){
        pauseScreen.classList.remove('hidden');
        touchUI.style.visibility='hidden';
      }else{
        touchUI.style.visibility='visible';
        rafId=requestAnimationFrame(step);
      }
    }else{
      buildLevel();
      render(performance.now());
    }
    // rotation can leave the audio graph in a suspended/glitchy state on
    // some mobile browsers — nudge it back to running
    Snd.resume();
  },260);
}
window.addEventListener('resize',handleViewportChange);
window.addEventListener('orientationchange',handleViewportChange);
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',handleViewportChange);
}

const GRAVITY=0.62,JUMP_V=-13.2,MOVE_ACCEL=0.9,MAX_VX=4.4,FRICTION=0.82;
const SAFE_REACH=118,SAFE_RISE=68,PLATFORM_COUNT=8;

let deaths=0,running=false,paused=false,rafId=null;
let keys={},touch={left:false,right:false,jump:false};

window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
  if((k===' '||k==='w'||k==='arrowup')&&!e.repeat) requestJump();
  keys[k]=true;
  if(k==='p')togglePause();
  if(k==='f')toggleFullscreen();
  if(k==='m'){Snd.init();doMute();}
  if(k==='escape'&&paused)togglePause();
});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});

// Jump is tap-triggered, not held: requestJump() only fires on the actual
// press event (keydown without OS auto-repeat, or touchstart/mousedown),
// so holding the button down no longer causes continuous bunny-hopping —
// it just arms one buffered jump that gets consumed on the next landing.
function requestJump(){ player.jumpBuf=8; }

function bindTouch(el,prop){
  const on=e=>{
    e.preventDefault();touch[prop]=true;el.classList.add('held');Snd.resume();
    if(prop==='jump') requestJump();
  };
  const off=e=>{e.preventDefault();touch[prop]=false;el.classList.remove('held');};
  el.addEventListener('touchstart',on,{passive:false});
  el.addEventListener('touchend',off,{passive:false});
  el.addEventListener('touchcancel',off,{passive:false});
  el.addEventListener('mousedown',on);el.addEventListener('mouseup',off);el.addEventListener('mouseleave',off);
}
bindTouch(document.getElementById('btnLeft'),'left');
bindTouch(document.getElementById('btnRight'),'right');
bindTouch(document.getElementById('btnJump'),'jump');

const rand=(a,b)=>a+Math.random()*(b-a);
const choice=a=>a[Math.floor(Math.random()*a.length)];

/* ── Glitch bursts ─────────────────────────────────────────────
   Every platform occasionally "glitches" for a short, unpredictable
   burst: it wobbles, its spin/orbit direction reverses, whatever the
   level file wants to layer on top of its normal motion. It ALWAYS
   fully resolves back to exactly its normal, predictable path — the
   glitch is a zero-mean disruption, never a permanent change — so the
   guaranteed-solvable timing underneath is never actually broken, it
   just gets harder to read in the moment. A red flicker on the
   platform telegraphs "something's off right now" so it reads as a
   feature, not a bug.
   Call once per platform per frame; returns true while glitching and
   sets p._glitchEnv to a 0→1→0 envelope you can scale a wobble by. */
function glitchState(p, t, opts){
  opts = opts || {};
  const every = opts.every || [4500,9000];
  const dur = opts.dur || [500,950];
  if(p._glitchNext===undefined) p._glitchNext = t + rand(every[0],every[1]);
  if(!p._glitching && t>=p._glitchNext){
    p._glitching=true; p._glitchStart=t; p._glitchDur=rand(dur[0],dur[1]);
    p._glitchSeed=rand(0,Math.PI*2);
    if(typeof Snd!=='undefined') Snd.glitch();
  }
  if(p._glitching && t-p._glitchStart>=p._glitchDur){
    p._glitching=false; p._glitchNext=t+rand(every[0],every[1]);
  }
  p._glitchEnv = p._glitching ? Math.sin(Math.min(1,(t-p._glitchStart)/p._glitchDur)*Math.PI) : 0;
  p.glitching = p._glitching;
  return p._glitching;
}

let platforms,player,worldWidth,camX,startLedge,portal;
let stars=null,motes=null,puffs=[];


/* ══════════════════════════════════════════════════════════
   BACKGROUND IMAGE (optional, per level)
   Set window.BG_IMAGE='file.png' before bootGame(). The image
   is scaled to canvas height and mirror-tiled horizontally, so
   it can scroll forever with no visible seam. A pre-blurred copy
   is rendered ONCE into an offscreen canvas (blurring every frame
   would be far too slow), then tinted + sheened so the art reads
   as sitting behind a pane of glass, well behind the gameplay.
   ══════════════════════════════════════════════════════════ */
let bgImg=null, bgReady=false, bgGlass=null, bgGlassH=0, bgFailed=false;
function loadBackground(){
  if(!window.BG_IMAGE) return;
  bgImg=new Image();
  bgImg.onload=()=>{ bgReady=true; bgFailed=false; buildGlassLayer(); };
  bgImg.onerror=()=>{
    bgReady=false; bgFailed=true;
    console.warn('[DRIFT HOP] Background image failed to load: '+window.BG_IMAGE+
      '\nMake sure the "bg" folder sits next to this level file. '+
      'Some browsers also block local image loads over file:// — '+
      'if so, run a tiny local server (e.g. `python3 -m http.server`) and open via http://localhost:8000');
  };
  bgImg.src=window.BG_IMAGE;
}
function buildGlassLayer(){
  if(!bgReady||!bgImg) return;
  // scale to COVER the canvas: never let the art be shorter than the
  // viewport, and keep enough width that a single tile spans the screen
  const scaleFit=Math.max(H/bgImg.height, W/bgImg.width);
  const h=Math.max(1,Math.round(bgImg.height*scaleFit));
  const w=Math.max(1,Math.round(bgImg.width*scaleFit));
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const g=c.getContext('2d');
  const blur=(window.GLASS_BLUR===undefined)?1.2:window.GLASS_BLUR;
  if(blur>0 && 'filter' in g) g.filter=`blur(${blur}px)`;
  g.drawImage(bgImg,0,0,w,h);
  g.filter='none';
  // frosted tint: pushes the art back and stops it competing with play
  const tint=window.GLASS_TINT||'rgba(120,150,190,0.10)';
  g.fillStyle=tint; g.fillRect(0,0,w,h);
  // soft diagonal sheen, like light catching a pane
  const sheen=g.createLinearGradient(0,0,w*0.5,h);
  sheen.addColorStop(0,'rgba(255,255,255,0.00)');
  sheen.addColorStop(0.45,'rgba(255,255,255,0.03)');
  sheen.addColorStop(0.55,'rgba(255,255,255,0.012)');
  sheen.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=sheen; g.fillRect(0,0,w,h);
  bgGlass=c; bgGlassH=Math.round(H);
}
function drawBackgroundImage(t){
  if(!bgReady||!bgGlass) return false;
  if(bgGlassH!==Math.round(H)) buildGlassLayer(); // re-bake after a resize
  if(!bgGlass) return false;
  const bw=bgGlass.width;
  const par=(window.BG_PARALLAX===undefined)?0.25:window.BG_PARALLAX;
  const drift=(window.BG_DRIFT===undefined)?0.006:window.BG_DRIFT; // keeps moving while you wait
  let off=(camX*par + t*drift) % (bw*2);
  if(off<0) off+=bw*2;
  // mirror-tile: every other copy is flipped, so edges always match
  for(let k=-1;k*bw-off<W+bw;k++){
    const x=k*bw-off;
    if(x>W||x+bw<0) continue;
    const flipped=((k%2)+2)%2===1;
    ctx.save();
    const bh=bgGlass.height, yOff=H-bh; // anchor to bottom: terrain stays in frame
    if(flipped){ ctx.translate(x+bw,0); ctx.scale(-1,1); ctx.drawImage(bgGlass,0,yOff,bw,bh); }
    else { ctx.drawImage(bgGlass,x,yOff,bw,bh); }
    ctx.restore();
  }
  // vignette + lifted blacks completes the "under glass" read
  const vg=ctx.createRadialGradient(W/2,H*0.45,H*0.25,W/2,H*0.5,H*0.95);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(0,0,0,0.20)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
  return true;
}

function buildSky(){
  stars=[];
  for(let i=0;i<130;i++)stars.push({
    x:Math.random()*3000,y:Math.random()*H,r:rand(0.6,1.9),
    a:rand(0.25,0.9),depth:rand(0.15,0.5),tw:rand(0,Math.PI*2)});
  motes=[];
  for(let i=0;i<30;i++)motes.push({
    x:Math.random()*3000,y:Math.random()*H,r:rand(1.5,4),
    a:rand(0.08,0.25),depth:rand(0.5,0.8),ph:rand(0,Math.PI*2),sp:rand(0.0006,0.0016)});
  // Optional per-level extra layers (planets, clouds, rocks, comets, ...).
  // A level's inline script can define buildExtraSky() to add its own
  // scenery on top of the shared starfield without touching this file.
  if(typeof buildExtraSky==='function') buildExtraSky();
}

function addPuff(x,y,n,col){
  for(let i=0;i<n;i++)
    puffs.push({x,y,vx:rand(-1.6,1.6),vy:rand(-2.2,-0.3),r:rand(2,5)*scale,life:1,col});
}

/* ══════════════════════════════════════════════════════════
   GROUND LAND + SILHOUETTE PLATFORMS
   For image-backed levels, the start isn't a floating candy
   ledge — it's a chunk of actual terrain, coloured to match the
   environment so it reads as part of the world. Platforms use a
   single near-black body with a thin rim light, which keeps a
   clean silhouette look readable against a busy background
   (pure black alone would vanish into the dark lower third of
   these images). Opt in with window.LAND_STYLE.
   ══════════════════════════════════════════════════════════ */
function drawGroundLand(p){
  const st=window.LAND_STYLE; if(!st) return false;
  const bottom=H+40;
  ctx.save();
  // main mass, dropping off the bottom of the screen
  ctx.fillStyle=st.body;
  ctx.beginPath();
  ctx.moveTo(p.x-70*scale, bottom);
  ctx.lineTo(p.x-70*scale, p.y+16*scale);
  ctx.quadraticCurveTo(p.x-34*scale, p.y+2*scale, p.x, p.y);
  ctx.lineTo(p.x+p.w, p.y);
  ctx.quadraticCurveTo(p.x+p.w+30*scale, p.y+6*scale, p.x+p.w+52*scale, p.y+30*scale);
  ctx.lineTo(p.x+p.w+52*scale, bottom);
  ctx.closePath(); ctx.fill();
  // single flat colour — no rim line (set LAND_STYLE.rim to re-enable)
  if(st.rim){
    ctx.fillStyle=st.rim;
    ctx.fillRect(p.x, p.y, p.w, Math.max(2,2.5*scale));
  }
  ctx.restore();
  return true;
}

/* ══════════════════════════════════════════════════════════
   AMBIENT LIFE — a deliberately restrained layer for the
   image-backed levels: a handful of faint stars, occasional
   thin hairline comets, and slow drifting mist. Sized and
   dialled down so it registers as "the world is breathing"
   rather than competing with the art or the gameplay.
   Enable with window.AMBIENT = {...} before bootGame().
   ══════════════════════════════════════════════════════════ */
let ambStars=null, ambComets=[], ambNextComet=0, ambMist=null;
function buildAmbient(){
  const A=window.AMBIENT; if(!A) return;
  ambStars=[];
  const n=A.stars===undefined?26:A.stars;      // few, not a starfield
  for(let i=0;i<n;i++) ambStars.push({
    x:Math.random()*2600, y:Math.random()*H*0.55,
    r:rand(0.5,1.15), a:rand(0.18,0.5),
    depth:rand(0.05,0.16), tw:rand(0,Math.PI*2), sp:rand(0.0008,0.0018)});
  ambMist=[];
  const m=A.mist===undefined?7:A.mist;
  for(let i=0;i<m;i++) ambMist.push({
    x:Math.random()*2600, y:rand(H*0.30,H*0.80),
    w:rand(220,430), h:rand(26,54),
    a:rand(0.025,0.055), depth:rand(0.10,0.22),
    sp:rand(0.0016,0.0042), ph:rand(0,Math.PI*2)});
  ambComets=[]; ambNextComet=performance.now()+rand(3000,7000);
}
function drawAmbient(t){
  const A=window.AMBIENT; if(!A||!ambStars) return;
  const tint=A.tint||'255,250,235';

  for(const s of ambStars){
    const sx=((s.x-camX*s.depth)%(W+140)+W+140)%(W+140)-70;
    const tw=0.6+0.4*Math.sin(t*s.sp+s.tw);
    ctx.fillStyle=`rgba(${tint},${s.a*tw})`;
    ctx.beginPath(); ctx.arc(sx,s.y,s.r,0,Math.PI*2); ctx.fill();
  }

  // slow mist bands — very low alpha, just enough to feel like moving air
  for(const m of ambMist){
    const mx=((m.x-camX*m.depth)%(W+520)+W+520)%(W+520)-260;
    const my=m.y+Math.sin(t*m.sp*0.5+m.ph)*10;
    const g=ctx.createLinearGradient(mx,0,mx+m.w,0);
    g.addColorStop(0,`rgba(${tint},0)`);
    g.addColorStop(0.5,`rgba(${tint},${m.a})`);
    g.addColorStop(1,`rgba(${tint},0)`);
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.ellipse(mx+m.w/2,my,m.w/2,m.h/2,0,0,Math.PI*2); ctx.fill();
  }

  // thin hairline comets — small, fast, infrequent
  if(t>=ambNextComet){
    ambComets.push({x:rand(-60,W*0.5), y:rand(20,H*0.34),
      vx:rand(3.4,5.2), vy:rand(0.9,1.6), len:rand(26,52), life:1});
    ambNextComet=t+rand(5000,11000);
  }
  for(let i=ambComets.length-1;i>=0;i--){
    const c=ambComets[i];
    c.x+=c.vx; c.y+=c.vy; c.life-=0.014;
    if(c.x>W+80||c.life<=0){ ambComets.splice(i,1); continue; }
    const ang=Math.atan2(c.vy,c.vx);
    const tx=c.x-Math.cos(ang)*c.len, ty=c.y-Math.sin(ang)*c.len;
    const g=ctx.createLinearGradient(c.x,c.y,tx,ty);
    g.addColorStop(0,`rgba(${tint},${0.5*c.life})`);
    g.addColorStop(1,`rgba(${tint},0)`);
    ctx.strokeStyle=g; ctx.lineWidth=1; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(c.x,c.y); ctx.lineTo(tx,ty); ctx.stroke();
  }
}

// single-colour silhouette body + rim light, used by image-backed levels
function drawSilhouettePlatform(p,t,radius){
  const st=window.PLATFORM_STYLE; if(!st) return false;
  const r=(radius===undefined)?p.h*0.5:radius;
  ctx.save();
  if(p.glitching){ ctx.shadowColor='#ff2e6e'; ctx.shadowBlur=18+Math.sin(t*0.06)*8; }
  else { ctx.shadowColor=st.glow||st.rim; ctx.shadowBlur=12; }
  ctx.fillStyle=st.body;
  roundRect(p.x,p.y,p.w,p.h,r); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = p.glitching
    ? `rgba(255,46,110,${0.6+0.35*Math.sin(t*0.08)})`
    : st.rim;
  ctx.lineWidth=Math.max(1.2,1.6*scale);
  roundRect(p.x,p.y,p.w,p.h,r); ctx.stroke();
  return true;
}

/* ══════════════════════════════════════════════════════════
   TANTRUMS — an optional, shared annoyance layer any obstacle
   can opt into. A platform's actual position/motion formula is
   NEVER touched (so every level's proven-solvable geometry stays
   exactly as verified) — a tantrum only toggles a temporary
   "don't land on me right now" flag with a telegraphed warning,
   on a recurring schedule. Call updateTantrum(p,t) once per
   platform in a level's updatePlatforms(), and drawTantrumOverlay
   (p,t) at the end of its draw function. Opt a level in by setting
   window.TANTRUMS_ENABLED = true before bootGame().
   ══════════════════════════════════════════════════════════ */
function updateTantrum(p,t){
  if(!window.TANTRUMS_ENABLED || p===startLedge) return;
  if(p.nextTantrumAt===undefined){
    p.nextTantrumAt = t + rand(4500,9500);
    p.tantrum=false; p.tantrumWarn=false;
  }
  p.tantrumWarn = (!p.tantrum && t>=p.nextTantrumAt-500 && t<p.nextTantrumAt);
  if(p.tantrumWarn && !p._tantrumWarned){
    p._tantrumWarned=true;
    if(typeof Snd!=='undefined') Snd.wobble();
  }
  if(!p.tantrum && t>=p.nextTantrumAt){
    p.tantrum=true;
    p.tantrumEnd=t+rand(1300,2100);
    p._tantrumWarned=false;
    // if the player is standing on it right as it kicks off, knock them loose
    if(player && player.groundPlat===p && player.onGround){
      player.onGround=false;
      player.vy=Math.max(player.vy,0.7*scale);
    }
  }
  if(p.tantrum && t>=p.tantrumEnd){
    p.tantrum=false;
    p.nextTantrumAt=t+rand(6500,13000);
  }
}

function drawTantrumOverlay(p,t){
  if(!window.TANTRUMS_ENABLED) return;
  const cx=p.x+p.w/2, cy=p.y+p.h/2, rad=Math.max(p.w,p.h)/2;
  if(p.tantrumWarn){
    const pulse=0.5+0.5*Math.sin(t*0.03);
    ctx.save();
    ctx.strokeStyle=`rgba(255,209,102,${0.5+0.4*pulse})`;
    ctx.lineWidth=2.5*scale;
    ctx.beginPath();ctx.arc(cx,cy,rad+5*scale,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='rgba(255,209,102,0.9)';
    ctx.font=`bold ${Math.round(13*scale)}px sans-serif`;ctx.textAlign='center';
    ctx.fillText('!',cx,cy-rad-8*scale);
    ctx.restore();
  }
  if(p.tantrum){
    ctx.save();
    ctx.strokeStyle='rgba(255,70,90,0.85)';
    ctx.lineWidth=3*scale;
    ctx.setLineDash([5,4]);
    ctx.lineDashOffset=-t*0.05;
    ctx.beginPath();ctx.arc(cx,cy,rad+6*scale,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function resetPlayer(died){
  if(died){deaths++;deathCountEl.textContent=deaths;Snd.fall();}
  player.x=startLedge.x+startLedge.w/2-player.w/2;
  player.y=startLedge.y-player.h-2;
  player.vx=0;player.vy=0;player.onGround=true;
  player.groundPlat=startLedge;player.coyote=0;player.jumpBuf=0;
  player.visited=new Set();
}

function step(t){
  if(!running||paused)return;
  updatePlatforms(t);
  if(window.TANTRUMS_ENABLED) for(const p of platforms) updateTantrum(p,t);

  const left=keys['a']||keys['arrowleft']||touch.left;
  const right=keys['d']||keys['arrowright']||touch.right;

  if(left){player.vx-=MOVE_ACCEL*scale;player.facing=-1;}
  if(right){player.vx+=MOVE_ACCEL*scale;player.facing=1;}
  player.vx=Math.max(-MAX_VX*scale,Math.min(MAX_VX*scale,player.vx));
  player.vx*=FRICTION;

  // jumpBuf is only ever set by requestJump() (a discrete tap), never by
  // continuously holding a key/button — so it just counts down here.
  player.jumpBuf=Math.max(0,player.jumpBuf-1);
  if(player.onGround)player.coyote=7;else player.coyote=Math.max(0,player.coyote-1);
  if(player.jumpBuf>0&&player.coyote>0){
    // Fling bonus: jumping off a moving platform carries a slice of its
    // current velocity into your jump. Strictly additive — every level
    // proven solvable without this still works with it, it just rewards
    // jumping off a fast-moving platform (pendulums, drifting cubes, etc).
    const jgp=player.groundPlat;
    if(jgp && jgp._lastX!==undefined){
      player.vx += (jgp.x-jgp._lastX)*0.6;
    }
    player.vy=JUMP_V*scale;player.onGround=false;player.groundPlat=null;
    player.stretch=1;player.jumpBuf=0;player.coyote=0;
    Snd.hop();addPuff(player.x+player.w/2,player.y+player.h,5,'255,243,196');
  }

  const wasAir=!player.onGround;
  player.vy+=GRAVITY*scale;
  if(player.vy>16*scale)player.vy=16*scale;

  let cdx=0,cdy=0;const gp=player.groundPlat;
  if(player.onGround&&gp&&gp._lastX!==undefined){cdx=gp.x-gp._lastX;cdy=gp.y-gp._lastY;}
  player.x+=player.vx+cdx;player.y+=player.vy+cdy;

  if(player.y>H+80||player.x<-60){
    resetPlayer(true);render(t);rafId=requestAnimationFrame(step);return;
  }

  player.onGround=false;
  let landed=null;
  for(const p of platforms){
    if(p.tantrum) continue; // mid-tantrum: no collision, falls right through
    const feetPrev=player.y+player.h-player.vy,feetNow=player.y+player.h;
    const cx=player.x+player.w*0.5;
    if(player.vy>=0&&cx>p.x&&cx<p.x+p.w&&feetPrev<=p.y+2&&feetNow>=p.y){
      player.y=p.y-player.h;player.vy=0;player.onGround=true;landed=p;break;
    }
  }
  if(landed){
    player.groundPlat=landed;
    if(wasAir){Snd.land();player.squash=1;addPuff(player.x+player.w/2,player.y+player.h,6,'185,139,255');}
    player.visited.add(landed);
    if(landed.bouncePad){
      // Auto-launch: landing on a bounce pad immediately fires you back
      // up, regardless of jump input — the pad IS the jump. Your current
      // horizontal velocity carries through untouched, so steering before
      // and during the bounce is what actually aims the arc.
      player.vy = landed.bounceVel*scale;
      player.onGround=false; player.groundPlat=null;
      player.squash=0; player.stretch=1;
      landed.bounceFlashAt=t;
      Snd.boing();
      addPuff(player.x+player.w/2,player.y+player.h,7,'255,209,102');
    }
  }


  const dx=(player.x+player.w/2)-portal.x,dy=(player.y+player.h/2)-portal.y;
  if(Math.hypot(dx,dy)<portal.r){onWin();return;}

  for(const p of platforms){p._lastX=p.x;p._lastY=p.y;}

  const targetCam=player.x-W*0.34;
  camX+=(targetCam-camX)*0.12;
  camX=Math.max(0,Math.min(Math.max(0,worldWidth-W),camX));

  if(player.squash>0)player.squash*=0.84;
  if(player.stretch>0)player.stretch*=0.86;
  player.blinkT--;if(player.blinkT<-7)player.blinkT=rand(80,220);

  for(let i=puffs.length-1;i>=0;i--){
    const q=puffs[i];q.x+=q.vx;q.y+=q.vy;q.vy+=0.08;q.life-=0.035;
    if(q.life<=0)puffs.splice(i,1);
  }

  render(t);
  rafId=requestAnimationFrame(step);
}

function onWin(){
  running=false;paused=false;cancelAnimationFrame(rafId);
  Snd.win();Snd.stopMusic();
  saveCompletion(LEVEL_ID,deaths);
  pauseScreen.classList.add('hidden');
  overlayTitle.textContent='YOU MADE IT!';
  overlayText.innerHTML=winFlavorText(deaths);
  startBtn.textContent='↻ Play Again';
  const next=nextLevelId();
  const winRow=document.getElementById('winRow');
  const nextBtn=document.getElementById('nextBtn');
  if(next){
    winRow.style.display='flex';
    nextBtn.onclick=()=>{ window.location.href=LEVEL_FILES[next]; };
  }else{
    winRow.style.display='none';
  }
  overlay.classList.remove('hidden');
  touchUI.style.visibility='hidden';
}

function togglePause(){
  if(!running)return;
  Snd.click();paused=!paused;
  const btn=document.getElementById('btnPause');
  if(paused){
    cancelAnimationFrame(rafId);Snd.stopMusic();
    pauseScreen.classList.remove('hidden');
    btn.textContent='▶';btn.classList.add('active');
    touchUI.style.visibility='hidden';
  }else{
    pauseScreen.classList.add('hidden');
    btn.textContent='⏸';btn.classList.remove('active');
    touchUI.style.visibility='visible';
    Snd.startMusic();
    rafId=requestAnimationFrame(step);
  }
}
function retryFromPause(){
  Snd.click();paused=false;pauseScreen.classList.add('hidden');
  const b=document.getElementById('btnPause');b.textContent='⏸';b.classList.remove('active');
  cancelAnimationFrame(rafId);running=false;deaths=0;startRun();
}
function goHome(){
  Snd.click();Snd.stopMusic();
  cancelAnimationFrame(rafId);running=false;paused=false;
  exitFullscreenAndUnlock(()=>{ window.location.href=HOME_URL; });
}
function doMute(){
  const m=Snd.toggleMute();
  const b=document.getElementById('btnMute');
  b.textContent=m?'🔇':'🔊';b.classList.toggle('active',m);
}
function unlockOrientation(){
  try{
    if(screen.orientation&&screen.orientation.unlock) screen.orientation.unlock();
  }catch(e){}
}
function exitFullscreenAndUnlock(cb){
  const isFs=!!(document.fullscreenElement||document.webkitFullscreenElement);
  unlockOrientation();
  disableFakeFullscreen();
  if(isFs){
    const ex=document.exitFullscreen||document.webkitExitFullscreen;
    if(ex){
      ex.call(document).catch(()=>{}).then(()=>{ if(cb)cb(); });
      // exitFullscreen resolves quickly but isn't guaranteed on every browser,
      // so also fire the callback on a short timer as a fallback
      if(cb) setTimeout(cb,180);
      return;
    }
  }
  if(cb) cb();
}
function toggleFullscreen(){
  const el=document.documentElement;
  const isFs=!!(document.fullscreenElement||document.webkitFullscreenElement);
  const req=el.requestFullscreen||el.webkitRequestFullscreen;
  if(!isFs){
    if(req){
      req.call(el).catch(()=>{ enableFakeFullscreen(); });
    }else{
      // Fullscreen API unavailable entirely (notably iOS Safari) — fall
      // back to a CSS-only fixed-position "fill the viewport" mode so the
      // game still fits the screen instead of being clipped by browser chrome.
      enableFakeFullscreen();
    }
    if(isTouch&&screen.orientation&&screen.orientation.lock)screen.orientation.lock('landscape').catch(()=>{});
  }else{
    const ex=document.exitFullscreen||document.webkitExitFullscreen;
    if(ex)ex.call(document).catch(()=>{});
    disableFakeFullscreen();
    unlockOrientation();
  }
}
function enableFakeFullscreen(){
  document.body.classList.add('fake-fs');
  document.getElementById('btnFs').classList.add('active');
  window.scrollTo(0,0);
  setTimeout(handleViewportChange,80);
}
function disableFakeFullscreen(){
  document.body.classList.remove('fake-fs');
  document.getElementById('btnFs').classList.remove('active');
  setTimeout(handleViewportChange,80);
}
['fullscreenchange','webkitfullscreenchange'].forEach(ev=>{
  document.addEventListener(ev,()=>{
    const isFs=!!(document.fullscreenElement||document.webkitFullscreenElement);
    document.getElementById('btnFs').classList.toggle('active',isFs);
    // covers the case where fullscreen is exited by the OS/back-gesture
    // rather than our own button (Android back button, iOS swipe, etc.)
    if(!isFs) unlockOrientation();
    setTimeout(resize,120);
  });
});
window.addEventListener('pagehide',unlockOrientation);
window.addEventListener('beforeunload',unlockOrientation);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&running&&!paused)togglePause();
  if(!document.hidden)Snd.resume();
});

/* ═══════════ DRAWING ═══════════ */
function roundRect(x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

/* Momo — an original round cloud-cat creature, drawn from primitives */
function drawMomo(px,py,w,h,facing,squash,stretch,blinking,t){
  ctx.save();
  ctx.translate(px+w/2,py+h/2);
  ctx.scale(1+squash*0.22-stretch*0.14,1-squash*0.24+stretch*0.18);
  const s=scale;

  const aura=ctx.createRadialGradient(0,0,w*0.2,0,0,w*1.2);
  const auraCol=window.MOMO_AURA||'255,243,196';
  aura.addColorStop(0,`rgba(${auraCol},0.42)`);
  aura.addColorStop(1,`rgba(${auraCol},0)`);
  ctx.fillStyle=aura;ctx.beginPath();ctx.arc(0,0,w*1.2,0,Math.PI*2);ctx.fill();

  ctx.fillStyle='#ffe9a8';
  ctx.beginPath();ctx.moveTo(-w*0.36,-h*0.30);ctx.lineTo(-w*0.20,-h*0.62);ctx.lineTo(-w*0.06,-h*0.32);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(w*0.36,-h*0.30);ctx.lineTo(w*0.20,-h*0.62);ctx.lineTo(w*0.06,-h*0.32);ctx.closePath();ctx.fill();
  ctx.fillStyle='#ffb3a0';
  ctx.beginPath();ctx.moveTo(-w*0.28,-h*0.33);ctx.lineTo(-w*0.20,-h*0.52);ctx.lineTo(-w*0.13,-h*0.34);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(w*0.28,-h*0.33);ctx.lineTo(w*0.20,-h*0.52);ctx.lineTo(w*0.13,-h*0.34);ctx.closePath();ctx.fill();

  const body=ctx.createLinearGradient(0,-h/2,0,h/2);
  body.addColorStop(0,'#fffbe8');body.addColorStop(1,'#ffe4a3');
  ctx.fillStyle=body;
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
    ctx.fillStyle='#3a2450';
    ctx.beginPath();ctx.ellipse(-w*0.17+eo,-h*0.06,3.1*s,3.7*s,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(w*0.17+eo,-h*0.06,3.1*s,3.7*s,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.95)';
    ctx.beginPath();ctx.arc(-w*0.17+eo+1.1*s,-h*0.10,1.15*s,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(w*0.17+eo+1.1*s,-h*0.10,1.15*s,0,Math.PI*2);ctx.fill();
  }

  ctx.strokeStyle='#3a2450';ctx.lineWidth=1.5*s;ctx.lineCap='round';
  ctx.beginPath();ctx.arc(eo*0.5,h*0.10,2.6*s,0.18*Math.PI,0.82*Math.PI);ctx.stroke();

  ctx.strokeStyle='#ffe4a3';ctx.lineWidth=3*s;
  const tx=facing>=0?-w*0.48:w*0.48,dir=facing>=0?-1:1;
  ctx.beginPath();ctx.moveTo(tx,h*0.20);
  ctx.quadraticCurveTo(tx+dir*7*s,h*0.34+Math.sin(t*0.006)*2*s,tx+dir*2*s,h*0.46);
  ctx.stroke();

  ctx.restore();
}

function drawPortal(t,wx,wy,r){
  ctx.save();ctx.translate(wx,wy);
  const g=ctx.createRadialGradient(0,0,r*0.08,0,0,r*2.6);
  g.addColorStop(0,'rgba(255,255,255,0.98)');
  g.addColorStop(0.25,'rgba(255,243,196,0.6)');
  g.addColorStop(0.55,'rgba(185,139,255,0.35)');
  g.addColorStop(1,'rgba(185,139,255,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r*2.6,0,Math.PI*2);ctx.fill();
  for(let i=0;i<4;i++){
    ctx.save();ctx.rotate(t*0.0014*(i%2?-1:1)+i*1.2);
    ctx.strokeStyle=`rgba(255,255,255,${0.5-i*0.09})`;
    ctx.lineWidth=2.2*scale;
    ctx.beginPath();ctx.arc(0,0,r*(0.5+i*0.26),0,Math.PI*1.35);ctx.stroke();
    ctx.restore();
  }
  const pulse=1+Math.sin(t*0.004)*0.09;
  ctx.fillStyle='#fff';ctx.shadowColor='#ffe9a8';ctx.shadowBlur=26;
  ctx.beginPath();ctx.arc(0,0,r*0.4*pulse,0,Math.PI*2);ctx.fill();
  ctx.restore();
  ctx.fillStyle='rgba(255,243,196,0.65)';
  ctx.font=`bold ${Math.round(10*scale)}px sans-serif`;ctx.textAlign='center';
  ctx.fillText('PORTAL',wx,wy+r*2.4);
}

function render(t){
  const TH=window.SKY_THEME||{sky:['#150c2b','#2d1b4e','#4a2c6d','#6b3a72'],nebula:'185,139,255'};
  const usedImage = drawBackgroundImage(t);
  if(!usedImage){
    const sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,TH.sky[0]);sky.addColorStop(0.45,TH.sky[1]);
    sky.addColorStop(0.8,TH.sky[2]);sky.addColorStop(1,TH.sky[3]);
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  }

  const neb=ctx.createRadialGradient(W*0.7,H*0.25,10,W*0.7,H*0.25,H*0.9);
  neb.addColorStop(0,`rgba(${TH.nebula},0.16)`);
  neb.addColorStop(1,`rgba(${TH.nebula},0)`);
  if(window.SHOW_NEBULA!==false && !usedImage){ ctx.fillStyle=neb; ctx.fillRect(0,0,W,H); }

  drawAmbient(t);
  if(typeof drawExtraScenery==='function') drawExtraScenery(t);

  if(window.SHOW_STARS!==false){
    for(const s of stars){
      const sx=((s.x-camX*s.depth)%(W+200)+W+200)%(W+200)-100;
      const tw=0.55+0.45*Math.sin(t*0.002+s.tw);
      ctx.fillStyle=`rgba(255,250,230,${s.a*tw})`;
      ctx.beginPath();ctx.arc(sx,s.y,s.r,0,Math.PI*2);ctx.fill();
    }
  }
  if(window.SHOW_MOTES!==false){
    for(const m of motes){
      const mx=((m.x-camX*m.depth)%(W+200)+W+200)%(W+200)-100;
      ctx.fillStyle=`rgba(255,209,102,${m.a})`;
      ctx.beginPath();ctx.arc(mx,m.y+Math.sin(t*m.sp+m.ph)*16,m.r,0,Math.PI*2);ctx.fill();
    }
  }

  ctx.save();ctx.translate(-camX,0);
  drawPortal(t,portal.x,portal.y,portal.r);
  for(const p of platforms)drawPlatform(p,t);
  if(window.TANTRUMS_ENABLED) for(const p of platforms) drawTantrumOverlay(p,t);
  for(const q of puffs){
    ctx.fillStyle=`rgba(${q.col},${q.life*0.55})`;
    ctx.beginPath();ctx.arc(q.x,q.y,q.r*q.life,0,Math.PI*2);ctx.fill();
  }
  drawMomo(player.x,player.y,player.w,player.h,player.facing,player.squash,player.stretch,player.blinkT<0,t);
  ctx.restore();
}

function startRun(){
  Snd.init();Snd.resume();Snd.click();
  resize();buildLevel();
  deathCountEl.textContent=deaths;
  overlay.classList.add('hidden');pauseScreen.classList.add('hidden');
  document.getElementById('winRow').style.display='none';
  touchUI.style.visibility='visible';
  const b=document.getElementById('btnPause');b.textContent='⏸';b.classList.remove('active');
  overlayTitle.textContent=LEVEL_TITLE;
  running=true;paused=false;
  Snd.startMusic();
  cancelAnimationFrame(rafId);
  rafId=requestAnimationFrame(step);
}

startBtn.addEventListener('click',()=>{deaths=0;startRun();});
document.getElementById('resumeBtn').addEventListener('click',togglePause);
document.getElementById('retryBtn').addEventListener('click',retryFromPause);
document.getElementById('homeBtnPause').addEventListener('click',goHome);
document.getElementById('homeBtnMenu').addEventListener('click',goHome);
document.getElementById('btnHome').addEventListener('click',goHome);
document.getElementById('btnPause').addEventListener('click',togglePause);
document.getElementById('btnFs').addEventListener('click',toggleFullscreen);
document.getElementById('btnMute').addEventListener('click',()=>{Snd.init();doMute();});

// Called by the level's own inline script, once buildLevel/updatePlatforms/
// drawPlatform (and any scenery hooks) are defined.
function bootGame(){
  resize();loadBackground();buildSky();buildAmbient();buildLevel();
  touchUI.style.visibility='hidden';
  (function idle(){ if(!running||paused) render(performance.now()); requestAnimationFrame(idle); })();
}