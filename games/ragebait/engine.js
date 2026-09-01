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
// alpha:false — the canvas is fully repainted every frame (sky fill covers
// every pixel, see render()), so there's never anything beneath it that
// needs compositing. This tells the browser it can skip that work and
// often drop to a cheaper backing store.
//
// desynchronized:true USED TO BE SET HERE AND IS THE BUG.
// It asks the browser for a low-latency canvas: instead of the normal
// "draw into a buffer, hand the finished buffer to the compositor" path,
// the canvas gets its own swap chain that is presented as soon as possible.
// Desktop Chrome on integrated graphics quietly ignores the hint and uses
// the ordinary path, which is why the laptop looked perfect. Mobile GPU
// drivers DO honour it, and there the buffers are recycled WITHOUT being
// cleared and WITHOUT being fully synchronised with our draw calls — so the
// screen shows torn halves of two different frames, or straight-up
// uninitialised GPU memory. Uninitialised GPU memory is exactly the
// "random blocks of wrong colour that change every frame" artifact.
// It is a rendering hint worth a few ms of latency at best; it is not worth
// this. Removed.
const canvas=document.getElementById('game'), ctx=canvas.getContext('2d',{alpha:false});
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
  kick(vol=0.5){
    if(!this.ctx||this.muted)return;
    const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type='sine';o.frequency.setValueAtTime(150,t);
    o.frequency.exponentialRampToValueAtTime(42,t+0.11);
    g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.16);
    o.connect(g);g.connect(this.musicGain);
    o.start(t);o.stop(t+0.18);
  },
  hat(vol=0.16){
    if(!this.ctx||this.muted)return;
    const t=this.ctx.currentTime,n=Math.floor(this.ctx.sampleRate*0.045);
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const src=this.ctx.createBufferSource();src.buffer=buf;
    const f=this.ctx.createBiquadFilter();f.type='highpass';f.frequency.value=6500;
    const g=this.ctx.createGain();g.gain.value=vol;
    src.connect(f);f.connect(g);g.connect(this.musicGain);
    src.start(t);
  },
  startWindPad(){
    if(!this.ctx||this.windSrc)return;
    const bufSec=4, n=Math.floor(this.ctx.sampleRate*bufSec);
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
    const src=this.ctx.createBufferSource();src.buffer=buf;src.loop=true;
    const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=500;f.Q.value=0.6;
    const g=this.ctx.createGain();g.gain.value=0.25;//music volume//
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
      // A driving 16-step loop — original, unlicensed, synthesized at
      // runtime — built to give the player a hook to lock into instead of
      // just drifting ambience: kick+hat groove, a syncopated bassline,
      // and a short repeating lead riff that keeps resolving back to itself.
      const bass =[110,0,110,146.83,0,110,164.81,0, 110,0,130.81,146.83,0,146.81,110,0];
      const riff =[440,0,523.25,0, 493.88,0,440,392,  440,0,523.25,587.33, 523.25,0,440,0];
      const kicks=[1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0];
      const hats =[1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1];
      this.step=0;
      this.musicTimer=setInterval(()=>{
        if(this.muted)return;
        const s=this.step%16;
        if(kicks[s]) this.kick(0.55);
        if(hats[s]) this.hat(s%2===0?0.16:0.08);
        if(bass[s]) this.tone(bass[s],0.26,'sawtooth',0.30,bass[s]*0.85,this.musicGain);
        if(riff[s]) this.tone(riff[s],0.30,'triangle',0.20,null,this.musicGain);
        this.step++;
      },130);
      return;
    }
    const bass=[110,110,146.83,110,130.81,130.81,164.81,146.83];
    const lead=[523.25,587.33,659.25,783.99,880,783.99,659.25,587.33];
    this.step=0;
    this.musicTimer=setInterval(()=>{
      if(this.muted)return;
      const s=this.step%8;
      this.tone(bass[s],0.5,'sine',0.8,null,this.musicGain);
      if(s%2===0)this.tone(lead[s],0.75,'triangle',0.32,null,this.musicGain);
      if(s===0||s===4)this.tone(bass[s]*2,0.3,'sine',0.22,null,this.musicGain);
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
let _dprX=1,_dprY=1;      // device pixels per CSS pixel, per axis
function resize(){
  SW=holder.clientWidth; SH=holder.clientHeight;
  // Fill rate is the single biggest GPU cost, on phones AND on integrated-
  // graphics laptops alike: at dpr=2 every fullscreen fill (sky, nebula,
  // vignette) shades 4x the pixels for detail that's rarely visible at
  // normal play distance. Capping at 1.5 everywhere (not just touch)
  // keeps text/rims crisp at ~44% of dpr=2's pixel count.
  //
  // RENDER_SCALE goes a step further: it renders the actual canvas backing
  // store BELOW the screen's own CSS pixel size, then lets the browser
  // upscale it back up via canvas.style.width/height. That trades a
  // slightly softer image for fewer pixels the GPU has to fill every
  // single frame — 0.85 here means ~28% fewer total pixels than native.
  // 1 = off (native sharpness). Turn it down further (e.g. 0.75) for more
  // headroom on weaker GPUs, or set it back to 1 if smoothness is already
  // fine and you'd rather keep full sharpness.
  const RENDER_SCALE=0.75;

  // Mobile browsers fire resize/orientationchange while the layout is
  // mid-flight, and holder.clientWidth/Height can legitimately read 0 for a
  // frame or two (rotating, entering fullscreen, the URL bar collapsing).
  // Assigning 0 to canvas.width destroys the backing store; every draw after
  // that silently no-ops and whatever the compositor still has for that
  // element gets shown instead — more coloured garbage. Bail and let the
  // debounced handler try again once layout has settled.
  if(!(SW>0)||!(SH>0)) return;

  const rawDpr=Math.min(devicePixelRatio||1, 1.5)*RENDER_SCALE;
  // The backing store must be a whole number of pixels. Assigning a
  // fractional width (851*1.125 = 957.375) makes the browser truncate it, so
  // the transform below paints a hair wider than the buffer actually is and
  // the right/bottom edge keeps a strip that render() never writes to.
  // Round the buffer, then derive the real scale FROM the rounded buffer so
  // the two can't disagree.
  const bw=Math.max(1,Math.round(SW*rawDpr));
  const bh=Math.max(1,Math.round(SH*rawDpr));
  const dprX=bw/SW, dprY=bh/SH;
  canvas.width=bw; canvas.height=bh;
  canvas.style.width=SW+'px'; canvas.style.height=SH+'px';
  // On short screens (landscape phones) zoom the world out so a full jump
  // arc stays on screen instead of the character flying out of view.
  zoom = Math.min(1, SH/MIN_VIEW_H);
  W = SW/zoom; H = SH/zoom;              // everything else works in world units
  ctx.setTransform(dprX*zoom,0,0,dprY*zoom,0,0);
  _dprX=dprX; _dprY=dprY;   // kept so render() can clear in device pixels
  scale=Math.min(1,Math.max(0.7,W/720));
  // Reserve a gutter at the bottom for the on-screen controls so the world
  // never renders underneath them (standard mobile "safe play area").
  // 118 screen px covers the 84px HOP button plus its padding + safe-area.
  UI_GUTTER = isTouch ? 92/zoom : 0;
  PLAY_H = H - UI_GUTTER;
  // Cached gradients are built against the old dimensions/scale — drop the
  // keys so they get rebuilt at the new size on the next frame.
  _skyKey='';_nebKey='';_vigKey='';_momoAuraKey='';_momoBodyKey='';_portKey='';
  if(typeof ambMist!=='undefined' && ambMist) for(const m of ambMist) m._grad=null;
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
        resetClock();rafId=requestAnimationFrame(step);
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

// Portal-entry: once she overlaps the portal we don't cut straight to the
// win screen — she plays a short swirl-in (spiral toward center, spin,
// shrink) first. `entering` freezes normal input/physics for those frames.
let entering=false, enterT=0;
const ENTER_FRAMES=26;

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
  // Cheap O(1) read of a flag computed once per tick (see
  // computeTantrumSuppression) instead of re-scanning every platform here —
  // this used to be an O(N) neighbour search PER platform PER call, i.e.
  // O(N²) every physics tick, which is what was causing the frame-rate dip.
  if(p._suppressGlitch){
    if(p._glitching){ p._glitching=false; }
    p._glitchNext = Math.max(p._glitchNext, t + rand(1200,2400));
    p._glitchEnv = 0; p.glitching = false;
    return false;
  }
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
let _vigGrad=null,_vigKey='';
let _momoAuraGrad=null,_momoAuraKey='',_momoBodyGrad=null,_momoBodyKey='';
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
  let scaleFit=Math.max(H/bgImg.height, W/bgImg.width);
  // Mobile GPUs cap both a single canvas dimension (commonly 4096, still
  // 4096 on plenty of shipping Android parts) and total canvas area (iOS
  // Safari is the strict one). Go over either and you don't get an
  // exception — you get a canvas that is blank or filled with junk, which
  // then gets tiled across the whole screen every frame. A tall source
  // image on a wide landscape phone hits this easily. Scale down to fit
  // instead; the layer is blurred and tinted anyway, nobody can tell.
  const MAX_DIM=2048, MAX_AREA=2048*2048;
  {
    const dimCap=Math.min(MAX_DIM/(bgImg.width*scaleFit), MAX_DIM/(bgImg.height*scaleFit));
    if(dimCap<1) scaleFit*=dimCap;
    const area=(bgImg.width*scaleFit)*(bgImg.height*scaleFit);
    if(area>MAX_AREA) scaleFit*=Math.sqrt(MAX_AREA/area);
  }
  const h=Math.max(1,Math.round(bgImg.height*scaleFit));
  const w=Math.max(1,Math.round(bgImg.width*scaleFit));
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const g=c.getContext('2d');
  const blur=(window.GLASS_BLUR===undefined)?1.2:window.GLASS_BLUR;
  // ctx.filter is unsupported on older iOS Safari and buggy on some Android
  // WebViews; feature-detect properly instead of trusting `'filter' in g`,
  // which is true even where assignment silently does nothing.
  if(blur>0){
    try{ g.filter=`blur(${blur}px)`; if(g.filter==='none') g.filter='none'; }
    catch(e){ g.filter='none'; }
  }
  g.drawImage(bgImg,0,0,w,h);
  try{ g.filter='none'; }catch(e){}
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
  // The baked layer can come out smaller than the viewport if it had to be
  // clamped to a GPU-safe size (see buildGlassLayer). Scale it back up at
  // draw time so it always covers the full height — otherwise the top strip
  // of the screen is left unpainted every frame.
  const cover=Math.max(1, H/bgGlass.height);
  const bw=Math.ceil(bgGlass.width*cover);
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
    const bh=Math.ceil(bgGlass.height*cover), yOff=H-bh; // anchor to bottom: terrain stays in frame
    if(flipped){ ctx.translate(x+bw,0); ctx.scale(-1,1); ctx.drawImage(bgGlass,0,yOff,bw,bh); }
    else { ctx.drawImage(bgGlass,x,yOff,bw,bh); }
    ctx.restore();
  }
  // Vignette moved to a CSS element (#vignetteOverlay, toggled once in
  // bootGame()) — it's static screen-space darkening, so painting it in
  // canvas every frame was pure waste. See bootGame() for where it's shown.
  return true;
}

/* ---- Adaptive quality -------------------------------------------------
   Rather than guessing what a device can handle, watch the actual frame
   times and shed the expensive-but-inessential effects (shadow glows,
   vignette, some particles) when we're missing frame budget. Recovers
   automatically once there's headroom again, so a brief spike doesn't
   permanently downgrade the look. */
let FX=2;                       // 2 = full, 1 = reduced, 0 = minimal
let _fxSlow=0,_fxFast=0;
function fxSample(frameMs){
  if(frameMs>22){ _fxSlow++; _fxFast=0; if(_fxSlow>18 && FX>0){ FX--; _fxSlow=0; } }
  else if(frameMs<15){ _fxFast++; _fxSlow=0; if(_fxFast>240 && FX<2){ FX++; _fxFast=0; } }
}
/* Does this canvas support shadow glows right now? shadowBlur forces a
   full offscreen blur pass per draw call and is by far the most expensive
   op in the renderer, so it's the first thing to go. */
function fxGlow(){ return FX>=2; }

/* ---- Batched particle drawing -----------------------------------------
   The starfield/motes used to run `ctx.fillStyle = \`rgba(...,${a})\`` and a
   separate beginPath/arc/fill PER particle — ~190 string allocations, colour
   re-parses and draw calls every single frame. Alpha is quantized into a
   handful of buckets so all particles sharing a bucket go down as ONE path
   with ONE fillStyle, cutting the draw calls by roughly 20x. The colour
   strings are built once per bucket and cached, so the hot loop allocates
   nothing. Visually indistinguishable — the alpha step is 1/12th. */
const _PBUCKETS=12;
const _pBatch=[];               // reusable: index -> array of [x,y,r]
const _pStrCache=new Map();
for(let i=0;i<_PBUCKETS;i++) _pBatch.push([]);
function _pColor(tint,bucket){
  const key=tint+bucket;
  let s=_pStrCache.get(key);
  if(s===undefined){
    s=`rgba(${tint},${((bucket+0.5)/_PBUCKETS).toFixed(3)})`;
    _pStrCache.set(key,s);
  }
  return s;
}
function pBatchReset(){ for(let i=0;i<_PBUCKETS;i++) _pBatch[i].length=0; }
function pBatchAdd(x,y,r,a){
  if(a<=0.012||r<=0) return;
  let b=(a*_PBUCKETS)|0; if(b>=_PBUCKETS)b=_PBUCKETS-1; if(b<0)b=0;
  const arr=_pBatch[b]; arr.push(x,y,r);
}
function pBatchFlush(tint){
  for(let b=0;b<_PBUCKETS;b++){
    const arr=_pBatch[b];
    if(!arr.length) continue;
    ctx.fillStyle=_pColor(tint,b);
    ctx.beginPath();
    for(let i=0;i<arr.length;i+=3){
      const x=arr[i],y=arr[i+1],r=arr[i+2];
      ctx.moveTo(x+r,y);
      ctx.arc(x,y,r,0,Math.PI*2);
    }
    ctx.fill();
  }
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
  // Left edge is pushed far off-screen (purely visual — the player never
  // interacts with this side) so the ground always reaches past the left
  // edge of the viewport, whatever the screen width. Right edge stays
  // exactly at p.x+p.w, matching the real collision box precisely.
  const left=p.x-600*scale;
  ctx.save();
  ctx.fillStyle=st.body;
  ctx.fillRect(left, p.y, (p.x+p.w)-left, bottom-p.y);
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

  pBatchReset();
  for(const s of ambStars){
    const sx=((s.x-camX*s.depth)%(W+140)+W+140)%(W+140)-70;
    if(sx<-4||sx>W+4) continue;
    pBatchAdd(sx,s.y,s.r,s.a*(0.6+0.4*Math.sin(t*s.sp+s.tw)));
  }
  pBatchFlush(tint);

  // slow mist bands — very low alpha, just enough to feel like moving air.
  // The ramp is identical every frame apart from where it sits, so it's
  // built once in local space and translated into place rather than
  // reallocating one gradient per band per frame.
  if(FX>=1) for(const m of ambMist){
    const mx=((m.x-camX*m.depth)%(W+520)+W+520)%(W+520)-260;
    if(mx>W+40 || mx+m.w<-40) continue;   // off screen: skip entirely
    const my=m.y+Math.sin(t*m.sp*0.5+m.ph)*10;
    if(!m._grad){
      const g=ctx.createLinearGradient(0,0,m.w,0);
      g.addColorStop(0,`rgba(${tint},0)`);
      g.addColorStop(0.5,`rgba(${tint},${m.a})`);
      g.addColorStop(1,`rgba(${tint},0)`);
      m._grad=g;
    }
    ctx.save();
    ctx.translate(mx,0);
    ctx.fillStyle=m._grad;
    ctx.beginPath(); ctx.ellipse(m.w/2,my,m.w/2,m.h/2,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
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
  // shadowBlur triggers a full offscreen blur pass per draw. The glitch glow
  // is gameplay-critical telegraphing so it's always kept; the ambient rim
  // glow is decorative and drops out first when frames get tight.
  if(p.glitching){ ctx.shadowColor='#ff2e6e'; ctx.shadowBlur=18+Math.sin(t*0.06)*8; }
  else if(fxGlow()){ ctx.shadowColor=st.glow||st.rim; ctx.shadowBlur=12; }
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
/* How long the "!" warning shows before a platform actually goes
   phase-through. Long enough to read it, decide, and execute a jump. */
const TANTRUM_WARN_MS = 1600;
/* Two platforms this close (world px, centre to centre) must never be
   phase-through at the same time — otherwise the player can be stranded
   with both of their only options gone at once. */
const TANTRUM_MIN_SEPARATION = 260;

/* Can the player, standing at (px,py) with their feet on the deck, plausibly
   reach platform q? Uses distance + direction against the same SAFE_REACH /
   SAFE_RISE envelope every level is generated and verified against:
   dropping to a lower platform buys extra horizontal range, climbing to a
   higher one spends it. */
function tantrumCanReach(px, py, q){
  const reach=SAFE_REACH*scale, rise=SAFE_RISE*scale;
  const gap = (px < q.x) ? (q.x - px)
            : (px > q.x+q.w) ? (px - (q.x+q.w)) : 0;
  const dy = py - q.y;                 // >0 : q is BELOW the player
  if(dy >= 0) return gap <= reach*1.5; // falling — longer arc, easy
  const climb = -dy;                   // q is above: must be gained on the way
  if(climb > rise) return false;
  return gap <= reach * (1 - (climb/rise)*0.5);
}

/* Would going phase-through here strand the player? Only a concern when
   they're actually standing on p — otherwise it costs them nothing. */
function tantrumIsEscapable(p){
  if(!player || player.groundPlat!==p || !player.onGround) return true;
  const px=player.x+player.w*0.5, py=player.y+player.h;
  for(const q of platforms){
    if(q===p || q.tantrum) continue;
    if(tantrumCanReach(px,py,q)) return true;
  }
  return false;   // nowhere to go — this platform doesn't get to act up
}

/* Is any platform near p currently mid-tantrum (or warning up for one)? */
function tantrumNeighbourBusy(p){
  const pcx=p.x+p.w/2;
  for(const q of platforms){
    if(q===p) continue;
    if(!q.tantrum && !q.tantrumWarn) continue;
    if(Math.abs((q.x+q.w/2)-pcx) < TANTRUM_MIN_SEPARATION*scale) return true;
  }
  return false;
}

/* True while p, or a platform right next to it, is throwing a fit. Used to
   suppress glitch bursts nearby, so a phase-through is never compounded by
   its neighbour suddenly shaking or reversing direction at the same time. */
/* Computed ONCE per physics tick (not per platform) — walks the small set
   of platforms that are actually tantruming/warning right now (almost
   always 0, occasionally 1, never more thanks to TANTRUM_MIN_SEPARATION)
   and marks every platform within range on ._suppressGlitch. glitchState()
   just reads that flag, turning what used to be an O(N²)-per-tick scan
   into an O(N) pass. */
// Reused every tick instead of allocating a fresh array 60x/sec — this list
// is almost always empty or length 1 (TANTRUM_MIN_SEPARATION guarantees at
// most a couple of platforms are ever active at once).
const _tantrumActive=[];
function computeTantrumSuppression(){
  _tantrumActive.length=0;
  for(const p of platforms){
    p._suppressGlitch = (p.tantrum || p.tantrumWarn);
    if(p._suppressGlitch) _tantrumActive.push(p);
  }
  if(!_tantrumActive.length) return;
  for(const p of platforms){
    if(p._suppressGlitch) continue;
    const pcx=p.x+p.w/2;
    for(const a of _tantrumActive){
      if(Math.abs((a.x+a.w/2)-pcx) < TANTRUM_MIN_SEPARATION*scale){ p._suppressGlitch=true; break; }
    }
  }
}

function updateTantrum(p,t){
  if(!window.TANTRUMS_ENABLED || p===startLedge) return;
  if(p.nextTantrumAt===undefined){
    p.nextTantrumAt = t + rand(4500,9500);
    p.tantrum=false; p.tantrumWarn=false; p.tantrumFade=1;
  }

  // ---- warning phase -----------------------------------------------------
  const wantWarn = !p.tantrum && t>=p.nextTantrumAt-TANTRUM_WARN_MS && t<p.nextTantrumAt;
  if(wantWarn && !p.tantrumWarn){
    // Only START a warning if it's actually fair right now: nothing close by
    // is already acting up, and the player isn't left without an exit.
    if(tantrumNeighbourBusy(p) || !tantrumIsEscapable(p)){
      p.nextTantrumAt = t + rand(2500,5000);   // back off, try again later
    }else{
      p.tantrumWarn=true;
      if(typeof Snd!=='undefined') Snd.wobble();
    }
  }
  if(p.tantrumWarn && t>=p.nextTantrumAt) p.tantrumWarn=false;

  // ---- commit ------------------------------------------------------------
  if(!p.tantrum && t>=p.nextTantrumAt){
    // Re-check at the last moment — the player may have hopped ONTO this
    // platform during the warning, or a neighbour may have started up.
    if(tantrumNeighbourBusy(p) || !tantrumIsEscapable(p)){
      p.nextTantrumAt = t + rand(3000,6000);
    }else{
      p.tantrum=true;
      p.tantrumStart=t;
      p.tantrumEnd=t+rand(1300,2100);
    }
  }

  // ---- fade --------------------------------------------------------------
  // Phase-through platforms visibly go translucent, so "you'll fall through
  // this" is readable at a glance rather than only from the dashed ring.
  if(p.tantrum){
    const inK=Math.min(1,(t-p.tantrumStart)/220);
    const outK=Math.min(1,Math.max(0,(p.tantrumEnd-t)/260));
    p.tantrumFade = 1 - 0.72*Math.min(inK,outK);
  }else{
    p.tantrumFade = Math.min(1, (p.tantrumFade===undefined?1:p.tantrumFade) + 0.05);
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
    // remaining fraction of the warning window, drawn as a depleting arc —
    // the player can SEE how long they've still got to get clear
    const left=Math.max(0,Math.min(1,(p.nextTantrumAt-t)/TANTRUM_WARN_MS));
    ctx.save();
    ctx.strokeStyle=`rgba(255,209,102,${0.22+0.15*pulse})`;
    ctx.lineWidth=2.5*scale;
    ctx.beginPath();ctx.arc(cx,cy,rad+5*scale,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=`rgba(255,209,102,${0.75+0.25*pulse})`;
    ctx.lineWidth=3*scale;ctx.lineCap='round';
    ctx.beginPath();
    ctx.arc(cx,cy,rad+5*scale,-Math.PI/2,-Math.PI/2+Math.PI*2*left);
    ctx.stroke();
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

/* ══════════════════════════════════════════════════════════
   MOMO — secondary motion (tail / ears / body lean / eye squint)
   Every value here is a spring-damper chasing a TARGET derived from
   the player's actual velocity/airtime/state each frame — never a
   fixed animation clip — so it stays correct no matter the platform
   type, fall distance, or speed involved. ensureAnimState() seeds the
   fields once per player object (buildLevel() makes a fresh player
   per level/retry, so this just needs to run once per object).
   ══════════════════════════════════════════════════════════ */
/* ensureAnimState() / updateMomoAnim() — moved to momo.js */

function resetPlayer(died){
  if(died){deaths++;deathCountEl.textContent=deaths;Snd.fall();}
  player.x=startLedge.x+startLedge.w/2-player.w/2;
  player.y=startLedge.y-player.h-2;
  player.vx=0;player.vy=0;player.onGround=true;
  player.groundPlat=startLedge;player.coyote=0;player.jumpBuf=0;
  player.visited=new Set();
}

/* ---- Fixed-timestep driver -------------------------------------------
   requestAnimationFrame fires at the display's refresh rate (60/90/120/
   144Hz). The physics below is written in per-tick units, so running it
   once per rAF made the game literally run at double speed on a 120Hz
   screen while the time-based platforms kept their real pace — desyncing
   the two and invalidating the solvability proofs.

   Instead of scaling velocities by dt (which subtly changes every jump
   arc), we accumulate real elapsed time and run simulate() in exact
   1/60s ticks. The physics math is bit-for-bit what it always was at
   60Hz; only the render rate follows the display.

   MAX_SUBSTEPS caps how much we'll catch up in one frame. Without it, a
   lag spike or a tab-switch would dump hundreds of ticks at once and
   tunnel Momo straight through platforms.                              */
const FIXED_DT=1000/60, MAX_SUBSTEPS=5;
let simTime=0, accum=0, lastRAF=0;
// Call before (re)entering the loop so a pause/resume gap isn't treated
// as elapsed game time and replayed as a burst of catch-up ticks.
function resetClock(){ lastRAF=0; accum=0; }
// Give every run a clean slate at full quality; the governor will pull it
// back down within a fraction of a second if the device genuinely can't cope.
function resetQuality(){ FX=2; _fxSlow=0; _fxFast=0; }

function step(t){
  if(!running||paused)return;

  if(!lastRAF){ lastRAF=t; simTime=t; }
  let frameTime=t-lastRAF;
  lastRAF=t;
  if(frameTime>250) frameTime=FIXED_DT; // returned from background: don't catch up
  accum+=frameTime;

  let n=0;
  while(accum>=FIXED_DT && n<MAX_SUBSTEPS){
    accum-=FIXED_DT;
    simTime+=FIXED_DT;
    n++;
    const r=simulate(simTime);
    if(r==='halt') break;      // entering/win/reset: stop simulating this frame
    if(r==='stop') return;     // simulation ended the loop itself
  }
  if(accum>FIXED_DT*MAX_SUBSTEPS) accum=0; // drop unrecoverable backlog

  // Feed the real inter-frame time to the quality governor BEFORE rendering,
  // so a device that can't hold 60fps sheds effects within ~0.3s instead of
  // grinding. Ignore the first frame and any post-background jump.
  if(frameTime>0 && frameTime<250) fxSample(frameTime);

  render(simTime);
  rafId=requestAnimationFrame(step);
}

/* Runs exactly one 1/60s tick. `t` is the virtual sim clock, which
   advances in fixed increments so platform motion stays deterministic.
   Returns 'halt' to stop further substeps this frame, 'stop' if it has
   taken over the loop, or undefined to continue normally. */
function simulate(t){
  if(window.TANTRUMS_ENABLED){
    for(const p of platforms) updateTantrum(p,t);
    computeTantrumSuppression();   // one O(N) pass, cached for glitchState below
  }
  updatePlatforms(t);
  updateMomoAnim(t);

  if(entering){
    // Freeze normal input/physics and spiral her into the portal center:
    // spin, shrink, done — THEN show the win screen, instead of cutting
    // to it the instant she overlaps the ring.
    enterT++;
    const k=Math.min(1,enterT/ENTER_FRAMES);
    const ease=1-Math.pow(1-k,3); // ease-out: fast pull, gentle finish
    const swirl=k*Math.PI*2.4;
    const pullR=(1-ease)*46*scale;
    player.x=portal.x-player.w/2+Math.cos(swirl)*pullR*0.55;
    player.y=portal.y-player.h/2+Math.sin(swirl)*pullR*0.55;
    player.enterSpin=swirl;
    player.enterScale=1-ease*0.82;
    if(enterT%3===0) addPuff(portal.x+Math.cos(swirl)*10*scale,portal.y+Math.sin(swirl)*10*scale,2,'255,243,196');
    if(enterT>=ENTER_FRAMES){ entering=false; onWin(); return 'stop'; }
    return 'halt';
  }

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
    resetPlayer(true);return 'halt';
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
  if(Math.hypot(dx,dy)<portal.r){
    entering=true;enterT=0;player.vx=0;player.vy=0;
    Snd.hop();addPuff(player.x+player.w/2,player.y+player.h/2,8,'255,243,196');
    return 'halt';
  }

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
    nextBtn.onclick=()=>{
      // Flag the hand-off so the next level knows it's a level->level jump
      // and can re-take the landscape lock as soon as it has a gesture.
      try{ sessionStorage.setItem('ragebait_landscape','1'); }catch(e){}
      window.location.href=LEVEL_FILES[next];
    };
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
    resetClock();rafId=requestAnimationFrame(step);
  }
}
function retryFromPause(){
  Snd.click();paused=false;pauseScreen.classList.add('hidden');
  const b=document.getElementById('btnPause');b.textContent='⏸';b.classList.remove('active');
  cancelAnimationFrame(rafId);running=false;deaths=0;startRun();
}
function goHome(){
  Snd.click();Snd.stopMusic();
  try{ sessionStorage.removeItem('ragebait_landscape'); }catch(e){}
  cancelAnimationFrame(rafId);running=false;paused=false;
  exitFullscreenAndUnlock(()=>{ window.location.href=HOME_URL; });
}
function doMute(){
  const m=Snd.toggleMute();
  const b=document.getElementById('btnMute');
  b.textContent=m?'🔇':'🔊';b.classList.toggle('active',m);
}
/* ---- Landscape lock ---------------------------------------------------
   RAGEBAIT is landscape-only. An orientation lock belongs to a single
   document, so the browser drops it the instant we navigate to the next
   level — the new page has to take it again, and re-taking it needs a
   user gesture. lockLandscape() therefore runs from Start (and from the
   fullscreen button), both of which are real taps.

   We only ever give the lock back in goHome(), so hopping level -> level
   stays landscape the whole way through. */
function lockLandscape(){
  if(!isTouch) return;
  try{
    const el=document.documentElement;
    // Most browsers refuse orientation.lock() outside fullscreen, so take
    // fullscreen first when we aren't already in it.
    const isFs=!!(document.fullscreenElement||document.webkitFullscreenElement);
    const req=el.requestFullscreen||el.webkitRequestFullscreen;
    if(!isFs&&req){
      const p=req.call(el);
      if(p&&p.then) p.then(doLock).catch(()=>{ enableFakeFullscreen(); doLock(); });
      else doLock();
    }else{
      doLock();
    }
  }catch(e){}
  function doLock(){
    try{
      if(screen.orientation&&screen.orientation.lock)
        screen.orientation.lock('landscape').catch(()=>{});
    }catch(e){}
  }
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
    // deliberately NOT unlocking: leaving fullscreen shouldn't drop the
    // player back into portrait mid-run. Only goHome() releases the lock.
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
    // An OS/back-gesture exit from fullscreen used to unlock orientation
    // here, which flipped the player back to portrait mid-level. The lock
    // now survives it — goHome() is the only place it's released.
    if(!isFs) disableFakeFullscreen();
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
/* drawMomo() — moved to momo.js */

let _portGrad=null,_portKey='';
function drawPortal(t,wx,wy,r){
  ctx.save();ctx.translate(wx,wy);
  // Gradient is drawn in the translated local space, so it only depends on
  // r — cache it rather than rebuilding the ramp every frame.
  if(_portKey!==String(r)){
    const g=ctx.createRadialGradient(0,0,r*0.08,0,0,r*2.6);
    g.addColorStop(0,'rgba(255,255,255,0.98)');
    g.addColorStop(0.25,'rgba(255,243,196,0.6)');
    g.addColorStop(0.55,'rgba(185,139,255,0.35)');
    g.addColorStop(1,'rgba(185,139,255,0)');
    _portGrad=g;_portKey=String(r);
  }
  ctx.fillStyle=_portGrad;ctx.beginPath();ctx.arc(0,0,r*2.6,0,Math.PI*2);ctx.fill();
  for(let i=0;i<4;i++){
    ctx.save();ctx.rotate(t*0.0014*(i%2?-1:1)+i*1.2);
    ctx.strokeStyle=`rgba(255,255,255,${0.5-i*0.09})`;
    ctx.lineWidth=2.2*scale;
    ctx.beginPath();ctx.arc(0,0,r*(0.5+i*0.26),0,Math.PI*1.35);ctx.stroke();
    ctx.restore();
  }
  const pulse=1+Math.sin(t*0.004)*0.09;
  ctx.fillStyle='#fff';if(fxGlow()){ctx.shadowColor='#ffe9a8';ctx.shadowBlur=26;}
  ctx.beginPath();ctx.arc(0,0,r*0.4*pulse,0,Math.PI*2);ctx.fill();
  ctx.restore();
  ctx.fillStyle='rgba(255,243,196,0.65)';
  ctx.font=`bold ${Math.round(10*scale)}px sans-serif`;ctx.textAlign='center';
  ctx.fillText('PORTAL',wx,wy+r*2.4);
}

/* Gradients are immutable objects tied to their coordinates, so any that
   don't move can be built once and reused. Rebuilding them every frame
   (as this did) allocates and re-rasterizes a ramp 60x/sec for nothing. */
let _skyGrad=null,_skyKey='',_nebGrad=null,_nebKey='';
const _onScreen=[];
function render(t){
  // Belt-and-braces opaque clear of the ENTIRE backing store, in raw device
  // pixels, before anything else touches it. The code below does paint over
  // every pixel in the normal case, but "the normal case" is doing a lot of
  // work: the sky fill is skipped when a background image is used, the image
  // tiles are anchored bottom-left and rely on the glass layer being at least
  // as big as the viewport, and any of that can be one frame stale right
  // after a rotate. On a desktop compositor a missed pixel just shows the
  // previous frame and nobody notices. On mobile it shows whatever was last
  // in that block of GPU memory. One fillRect per frame is a rounding error
  // in the budget and removes the entire class of problem.
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='#0d0720';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.restore();

  const TH=window.SKY_THEME||{sky:['#150c2b','#2d1b4e','#4a2c6d','#6b3a72'],nebula:'185,139,255'};
  const usedImage = drawBackgroundImage(t);
  if(!usedImage){
    const key=H+'|'+TH.sky.join(',');
    if(_skyKey!==key){
      const sky=ctx.createLinearGradient(0,0,0,H);
      sky.addColorStop(0,TH.sky[0]);sky.addColorStop(0.45,TH.sky[1]);
      sky.addColorStop(0.8,TH.sky[2]);sky.addColorStop(1,TH.sky[3]);
      _skyGrad=sky;_skyKey=key;
    }
    ctx.fillStyle=_skyGrad;ctx.fillRect(0,0,W,H);
  }

  // Build the nebula ramp only when it's actually going to be painted —
  // levels 1/2/3/8 disable it, and this was being allocated for them anyway.
  if(window.SHOW_NEBULA!==false && !usedImage && FX>=1){
    const key=W+'x'+H+'|'+TH.nebula;
    if(_nebKey!==key){
      const neb=ctx.createRadialGradient(W*0.7,H*0.25,10,W*0.7,H*0.25,H*0.9);
      neb.addColorStop(0,`rgba(${TH.nebula},0.16)`);
      neb.addColorStop(1,`rgba(${TH.nebula},0)`);
      _nebGrad=neb;_nebKey=key;
    }
    ctx.fillStyle=_nebGrad; ctx.fillRect(0,0,W,H);
  }

  drawAmbient(t);
  if(typeof drawExtraScenery==='function') drawExtraScenery(t);

  // Batched: one fillStyle + one path per alpha bucket instead of one of
  // each per star. Off-screen stars are skipped before any math is done.
  if(window.SHOW_STARS!==false){
    pBatchReset();
    // At reduced quality thin out the starfield rather than dropping it —
    // the parallax still reads, it just costs proportionally less.
    const stepN = FX>=2 ? 1 : (FX===1 ? 2 : 3);
    const twT=t*0.002;
    for(let i=0;i<stars.length;i+=stepN){
      const s=stars[i];
      const sx=((s.x-camX*s.depth)%(W+200)+W+200)%(W+200)-100;
      if(sx<-4||sx>W+4) continue;
      pBatchAdd(sx,s.y,s.r,s.a*(0.55+0.45*Math.sin(twT+s.tw)));
    }
    pBatchFlush('255,250,230');
  }
  if(window.SHOW_MOTES!==false && FX>=1){
    pBatchReset();
    for(const m of motes){
      const mx=((m.x-camX*m.depth)%(W+200)+W+200)%(W+200)-100;
      if(mx<-6||mx>W+6) continue;
      pBatchAdd(mx,m.y+Math.sin(t*m.sp+m.ph)*16,m.r,m.a);
    }
    pBatchFlush('255,209,102');
  }

  ctx.save();ctx.translate(-camX,0);
  const viewL=camX-160, viewR=camX+W+160;
  if(portal.x+portal.r*2.6>viewL && portal.x-portal.r*2.6<viewR)
    drawPortal(t,portal.x,portal.y,portal.r);
  // Only draw what's actually on screen. Each platform draw sets shadowBlur
  // (one of the most expensive canvas ops there is), and a level is several
  // screens wide — so on levels 7/8 this was paying for 10-12 blurred draws
  // per frame when only 2-3 were ever visible. _onScreen is a reused buffer
  // (cleared, not reallocated) since this runs every single render frame.
  _onScreen.length=0;
  for(const p of platforms){
    const pad=(p.size||p.w||0)+(p.rx||0)+(p.armLen||0);
    if(p.x+p.w+pad<viewL || p.x-pad>viewR) continue;
    _onScreen.push(p);
  }
  const onScreen=_onScreen;
  for(const p of onScreen){
    // A platform that's gone phase-through fades out, so its "you'll fall
    // straight through me" state is obvious without reading the ring.
    const fade=(p.tantrumFade===undefined)?1:p.tantrumFade;
    if(fade<1){ ctx.save(); ctx.globalAlpha=fade; drawPlatform(p,t); ctx.restore(); }
    else drawPlatform(p,t);
  }
  if(window.TANTRUMS_ENABLED) for(const p of onScreen) drawTantrumOverlay(p,t);
  // Puffs are nearly always one colour at a time, so batching them by alpha
  // collapses a burst of ~14 individual fills into two or three.
  if(puffs.length){
    pBatchReset();
    let pcol=null;
    for(const q of puffs){
      if(pcol===null) pcol=q.col;
      else if(q.col!==pcol){ pBatchFlush(pcol); pBatchReset(); pcol=q.col; }
      pBatchAdd(q.x,q.y,q.r*q.life,q.life*0.55);
    }
    if(pcol!==null) pBatchFlush(pcol);
  }
  drawMomo(player.x,player.y,player.w,player.h,player.facing,player.squash,player.stretch,player.blinkT<0,t,player);
  ctx.restore();
}

function popCountdown(el){
  // restart the CSS pop animation on a re-used element
  el.style.animation='none';
  void el.offsetWidth; // force reflow so the next line actually restarts it
  el.style.animation='';
}

function startRun(){
  // Everything here must run synchronously off the click/tap itself (audio
  // unlock + orientation lock both require a real user gesture) — but
  // nothing HEAVY happens yet. buildLevel() is deliberately deferred to
  // beginCountdown(), after the "3" has actually painted.
  Snd.init();Snd.resume();Snd.click();
  lockLandscape();   // real user gesture — re-takes the lock this document lost on navigation
  entering=false;enterT=0;
  overlay.classList.add('hidden');pauseScreen.classList.add('hidden');
  document.getElementById('winRow').style.display='none';
  touchUI.style.visibility='hidden';  // no controls while the countdown runs
  running=false;paused=false;
  cancelAnimationFrame(rafId);
  beginCountdown();
}

function beginCountdown(){
  const el=document.getElementById('countdownOverlay');
  const num=document.getElementById('countdownNum');
  el.classList.add('show');
  num.textContent='3';
  popCountdown(num);

  // One tick so the browser actually paints "3" before the main thread
  // gets blocked by buildLevel()'s synchronous work — this is the part
  // that hides the setup cost instead of freezing on a static screen.
  setTimeout(()=>{
    resize();buildLevel();
    deathCountEl.textContent=deaths;
    overlayTitle.textContent=LEVEL_TITLE;
    const b=document.getElementById('btnPause');b.textContent='⏸';b.classList.remove('active');

    // Warm-render one frame now, while it's still hidden behind the
    // countdown overlay. render() lazily (re)builds anything sized off the
    // canvas — sky/nebula/vignette/portal/Momo gradients, and for
    // image-backed levels the blurred background "glass" layer, which is
    // an offscreen canvas draw + CSS blur filter and by far the priciest
    // single op in the renderer. Without this, whichever frame happens to
    // trigger that work for real does it live — almost always frame 1,
    // right as "GO!" appears, which is exactly the stutter this avoids.
    // Also gets the actual level's platform-drawing code JIT-warm before
    // it has to run at 60fps for real. Purely a render — reads state,
    // doesn't advance physics or gameplay in any way.
    render(performance.now());


    // Level is fully built and verified-solvable by this point — now count
    // down for real. 2 → 1 → GO, then hand off to the actual game loop.
    let n=2;
    const step2=()=>{
      if(n>0){
        num.textContent=String(n); popCountdown(num); Snd.click();
        n--; setTimeout(step2,650);
      }else{
        num.textContent='GO!'; popCountdown(num); Snd.hop();
        setTimeout(()=>{
          el.classList.remove('show');
          touchUI.style.visibility='visible';
          running=true;paused=false;
          Snd.startMusic();
          resetQuality();resetClock();rafId=requestAnimationFrame(step);
        },420);
      }
    };
    step2();
  },30);
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
/* Orientation lock is a request, not a guarantee — iOS Safari ignores it
   outright, and Android honours it only inside fullscreen. So we also gate
   the game behind a rotate prompt: if the device is physically portrait,
   the level is covered until it's turned. Belt and braces. */
function updateOrientationGate(){
  if(!isTouch) return;
  const gate=document.getElementById('rotateGate');
  if(!gate) return;
  const portrait = window.innerHeight > window.innerWidth;
  gate.classList.toggle('hidden', !portrait);
  if(portrait && running && !paused) togglePause();
}
window.addEventListener('resize',updateOrientationGate);
window.addEventListener('orientationchange',()=>setTimeout(updateOrientationGate,120));

function bootGame(){
  // Build the rotate prompt once, so no level file has to carry the markup.
  if(isTouch && !document.getElementById('rotateGate')){
    const g=document.createElement('div');
    g.id='rotateGate'; g.className='hidden';
    g.innerHTML='<div class="rot-icon">\u21BB</div>'+
      '<h2>ROTATE YOUR DEVICE</h2>'+
      '<p>RAGEBAIT is built for landscape. Turn your phone sideways to play.</p>';
    document.body.appendChild(g);
  }
  // Countdown overlay, injected once so no level file has to carry the
  // markup. It sits over the live (idle-rendered) scene, semi-transparent,
  // so the player sees the world behind it rather than a blank screen —
  // and critically, the "3" is what's on screen while buildLevel() (which
  // can be the expensive part, especially on the pendulum/orbit levels)
  // actually runs, instead of the player just staring at a frozen Start
  // button for that same stretch of time.
  if(!document.getElementById('countdownOverlay')){
    const c=document.createElement('div');
    c.id='countdownOverlay';
    c.innerHTML='<div id="countdownNum">3</div>';
    holder.appendChild(c);
  }
  // Vignette: was a full-canvas radial-gradient fillRect every single
  // frame (drawBackgroundImage, below) on every image-backed level. It's
  // static screen-space darkening that never actually changes shape, so
  // it's moved here — a plain CSS element the compositor paints once and
  // then composites for free, instead of paying for it every frame.
  if(!document.getElementById('vignetteOverlay')){
    const v=document.createElement('div');
    v.id='vignetteOverlay';
    holder.appendChild(v);
  }
  if(window.BG_IMAGE) document.getElementById('vignetteOverlay').classList.add('show');
  resize();loadBackground();buildSky();buildAmbient();buildLevel();
  updateOrientationGate();
  // Arriving from a "Next Level" tap: the lock was dropped by navigation,
  // so grab it back on the very first touch this page receives.
  try{
    if(sessionStorage.getItem('ragebait_landscape')==='1'){
      const relock=()=>{ lockLandscape(); window.removeEventListener('pointerdown',relock); };
      window.addEventListener('pointerdown',relock,{once:true});
    }
  }catch(e){}
  touchUI.style.visibility='hidden';
  (function idle(){
    if(!running||paused){ updateMomoAnim(performance.now()); render(performance.now()); }
    requestAnimationFrame(idle);
  })();
}