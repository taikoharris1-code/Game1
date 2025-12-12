const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const restartBtn = document.getElementById('restart');
const pauseBtn = document.getElementById('pause');
const startMenu = document.getElementById('startMenu');
const startBtn = document.getElementById('startBtn');
const startFullscreenCheckbox = document.getElementById('startFullscreen');
const touchControls = document.getElementById('touch-controls');

function startGameWithDifficulty(diff){
  // set baseSpeed directly from difficulty preset
  if(diff in DIFFICULTY_PRESETS){
    baseSpeed = DIFFICULTY_PRESETS[diff];
  } else {
    baseSpeed = DIFFICULTY_PRESETS['normal'];
  }
  if(startMenu) startMenu.classList.add('hidden');
  // animate a mandarin dropping into the initial food position, then reset/start game
  const initialFood = food; // placeFood was called during preview init
  animateMandarinDrop(initialFood, ()=>{ reset(); });
}

// animate a mandarin dropping from top-center into the given cell position
function animateMandarinDrop(cellPos, cb){
  if(!cellPos) { if(cb) cb(); return; }
  // ensure image loaded
  const startAnim = ()=>{
    const canvasRect = canvas.getBoundingClientRect();
    const displayCell = canvasRect.width / GRID;
    const size = Math.max(32, Math.min(64, Math.floor(displayCell * 0.9)));
    const startX = canvasRect.left + canvasRect.width/2 - size/2;
    const startY = canvasRect.top - size - 8;
    const destX = canvasRect.left + (cellPos.x * displayCell) + (displayCell - size)/2;
    const destY = canvasRect.top + (cellPos.y * displayCell) + (displayCell - size)/2;

    const img = document.createElement('img');
    img.src = mandarinDataUrl;
    img.className = 'drop-fruit';
    img.style.position = 'fixed';
    img.style.left = startX + 'px';
    img.style.top = startY + 'px';
    img.style.width = size + 'px';
    img.style.height = size + 'px';
    img.style.transition = 'transform 560ms cubic-bezier(.2,.9,.2,1), top 560ms cubic-bezier(.2,.9,.2,1), left 560ms cubic-bezier(.2,.9,.2,1)';
    img.style.zIndex = 4000;
    img.style.pointerEvents = 'none';
    document.body.appendChild(img);

    // small rotate/scale during flight
    requestAnimationFrame(()=>{
      img.style.transform = 'translate(' + (destX - startX) + 'px,' + (destY - startY) + 'px) scale(1) rotate(10deg)';
    });

    function done(){
      img.remove();
      if(cb) cb();
    }
    img.addEventListener('transitionend', done, {once:true});
    // safety fallback
    setTimeout(()=>{ if(document.body.contains(img)) { img.remove(); if(cb) cb(); } }, 900);
  };

  if(mandImg.complete && mandImg.naturalWidth){ startAnim(); }
  else mandImg.onload = startAnim;
}

// helper to attempt entering native fullscreen or fallback to pseudo
async function maybeEnterFullscreenBeforeStart(){
  if(startFullscreenCheckbox && startFullscreenCheckbox.checked){
    if(!isFullscreen()){
      const target = canvasWrapper || canvas;
      try{
        const r = target.requestFullscreen || target.webkitRequestFullscreen || target.mozRequestFullScreen || target.msRequestFullscreen;
        if(r) await r.call(target);
        else enterPseudoFullscreen();
      }catch(e){
        // fallback
        enterPseudoFullscreen();
      }
    }
  }
}
const difficultyEl = document.getElementById('difficulty');

// difficulty presets map to baseSpeed (ms per step)
const DIFFICULTY_PRESETS = {
  easy: 200,
  normal: 120,
  hard: 70
};

// WebAudio for short effects
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioCtx ? new AudioCtx() : null;
let audioUnlocked = false;

// mandarin image (inline SVG) used for food and drop animation
const mandarinSvg = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
  <defs>
    <radialGradient id='g' cx='30%' cy='30%'>
      <stop offset='0%' stop-color='#fff7e6'/>
      <stop offset='40%' stop-color='#ffb347'/>
      <stop offset='100%' stop-color='#ff7f11'/>
    </radialGradient>
  </defs>
  <circle cx='50' cy='50' r='40' fill='url(#g)' stroke='#e86a00' stroke-width='3'/>
  <path d='M68 25c6-2 12 1 10 3-2 2-8 4-12 3' fill='none' stroke='#2b7a00' stroke-width='3' stroke-linecap='round'/>
  <path d='M48 18c-1-6-8-9-11-7-3 2 0 8 2 10' fill='none' stroke='#2b7a00' stroke-width='3' stroke-linecap='round'/>
</svg>`;
const mandarinDataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(mandarinSvg);
const mandImg = new Image(); mandImg.src = mandarinDataUrl;

function unlockAudio(){
  if(!audioCtx || audioUnlocked) return;
  // resume on first user gesture
  if(audioCtx.state === 'suspended'){
    audioCtx.resume().then(()=>{ audioUnlocked = true; }).catch(()=>{ audioUnlocked = true; });
  } else audioUnlocked = true;
}

function playSound(type){
  if(!audioCtx || !audioUnlocked) return;
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  if(type==='eat'){
    o.frequency.value = 800;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12, now+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.15);
    o.start(now); o.stop(now+0.16);
  } else if(type==='gameover'){
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, now);
    o.frequency.exponentialRampToValueAtTime(80, now+0.5);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.6);
    o.start(now); o.stop(now+0.62);
  } else if(type==='turn'){
    o.frequency.value = 1200;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.06, now+0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.05);
    o.start(now); o.stop(now+0.06);
  }
}

function computeSpeed(){
  // speed decreases (faster) by 8ms every 5 points, min 40
  return Math.max(40, baseSpeed - Math.floor(score/5)*8);
}


function reset(){
  snake = [{x: Math.floor(GRID/2), y: Math.floor(GRID/2)}];
  dir = {x:0,y:0};
  placeFood();
  speed = computeSpeed();
  score = 0;
  running = true;
  scoreEl.textContent = 'Score: 0';
  if(timer) clearInterval(timer);
  timer = setInterval(step, speed);
  draw();
}

function placeFood(){
  while(true){
    const pos = {x: Math.floor(Math.random()*GRID), y: Math.floor(Math.random()*GRID)};
    if(!snake.some(s => s.x===pos.x && s.y===pos.y)){ food = pos; break; }
  }
}

function step(){
  if(!running) return;
  // don't advance the game until the player sets a direction
  if(dir.x === 0 && dir.y === 0){ draw(); return; }
  const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
  // wrap-around behavior
  head.x = (head.x + GRID) % GRID;
  head.y = (head.y + GRID) % GRID;

  // collision with self
  if(snake.some(s => s.x===head.x && s.y===head.y)){
    gameOver();
    return;
  }

  snake.unshift(head);
  if(head.x===food.x && head.y===food.y){
    score += 1;
    scoreEl.textContent = 'Score: ' + score;
    // recompute speed when score changes
    speed = computeSpeed();
    clearInterval(timer); timer = setInterval(step, speed);
    playSound('eat');
    placeFood();
    // animate mandarin drop for new food
    animateMandarinDrop(food, ()=>{ /* animation complete */ });
  } else {
    snake.pop();
  }
  draw();
}

function gameOver(){
  running = false;
  clearInterval(timer);
  pauseBtn.textContent = 'Paused';
  setTimeout(()=> alert('Game Over — score: '+score), 50);
}

// Fullscreen handlers
function isFullscreen(){
  return document.fullscreenElement != null || document.webkitFullscreenElement != null;
}

function updateFullscreenButton(){
  if(!fullscreenBtn) return;
  fullscreenBtn.textContent = isFullscreen() ? '⤢' : '⤢';
}

if(fullscreenBtn){
  const requestFull = (el)=>{
    const r = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if(!r) return Promise.reject(new Error('requestFullscreen not supported'));
    return r.call(el);
  };
  const exitFull = ()=>{
    const e = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    if(!e) return Promise.reject(new Error('exitFullscreen not supported'));
    return e.call(document);
  };

  // keep reference to original parent so we can restore touch controls
  const originalTouchParent = touchControls ? touchControls.parentNode : null;
  const originalNextSibling = touchControls ? touchControls.nextSibling : null;

  fullscreenBtn.addEventListener('click', async (ev)=>{
    ev.preventDefault(); ev.stopPropagation();
    unlockAudio();
    try{
      if(!isFullscreen()){
        const target = canvasWrapper || canvas;
        try{
          await requestFull(target);
        }catch(err){
          // fallback to pseudo-fullscreen on mobile / restricted browsers
          enterPseudoFullscreen();
        }
      } else {
        await exitFull();
      }
    }catch(e){
      console.warn('Fullscreen toggle failed', e);
    }
  });

  // update the button icon when fullscreen state changes and move touch controls
  function onFullChange(){
    const fs = isFullscreen();
    fullscreenBtn.textContent = fs ? '⤡' : '⤢';
    fullscreenBtn.setAttribute('aria-pressed', fs ? 'true' : 'false');

    if(touchControls){
      if(fs){
        // move controls inside the wrapper so they overlay the canvas
        try{ canvasWrapper.appendChild(touchControls); }catch(e){}
        touchControls.classList.remove('touch-hidden');
        touchControls.setAttribute('aria-hidden', 'false');
      } else {
        // if we are in pseudo-fullscreen, do not restore yet
        if(canvasWrapper.classList.contains('pseudo-fullscreen')) return;
        // restore original position
        if(originalTouchParent){
          if(originalNextSibling) originalTouchParent.insertBefore(touchControls, originalNextSibling);
          else originalTouchParent.appendChild(touchControls);
        }
        // hide on non-coarse pointers
        if(window.matchMedia && window.matchMedia('(pointer:coarse)').matches){
          touchControls.classList.remove('touch-hidden');
        } else {
          touchControls.classList.add('touch-hidden');
        }
        touchControls.setAttribute('aria-hidden', touchControls.classList.contains('touch-hidden') ? 'true' : 'false');
      }
    }
  }

  document.addEventListener('fullscreenchange', onFullChange);
  document.addEventListener('webkitfullscreenchange', onFullChange);
  document.addEventListener('mozfullscreenchange', onFullChange);
  document.addEventListener('MSFullscreenChange', onFullChange);
  // ensure initial label
  updateFullscreenButton();
}

let pseudoActive = false;
function enterPseudoFullscreen(){
  if(!canvasWrapper) return;
  if(pseudoActive) return;
  // prevent body scroll
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  canvasWrapper.classList.add('pseudo-fullscreen');
  // move touch controls inside wrapper
  if(touchControls) canvasWrapper.appendChild(touchControls);
  touchControls.classList.remove('touch-hidden');
  touchControls.setAttribute('aria-hidden','false');
  pseudoActive = true;
  fullscreenBtn.textContent = '⤡';
  fullscreenBtn.setAttribute('aria-pressed','true');
  // adjust canvas to fit available space (stacked controls)
  adjustCanvasForFullscreen();
}

function exitPseudoFullscreen(){
  if(!pseudoActive) return;
  canvasWrapper.classList.remove('pseudo-fullscreen');
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  // restore touch controls to original place
  if(originalTouchParent){
    if(originalNextSibling) originalTouchParent.insertBefore(touchControls, originalNextSibling);
    else originalTouchParent.appendChild(touchControls);
  }
  // hide on non-coarse pointers
  if(window.matchMedia && window.matchMedia('(pointer:coarse)').matches){
    touchControls.classList.remove('touch-hidden');
  } else {
    touchControls.classList.add('touch-hidden');
  }
  touchControls.setAttribute('aria-hidden', touchControls.classList.contains('touch-hidden') ? 'true' : 'false');
  pseudoActive = false;
  fullscreenBtn.textContent = '⤢';
  fullscreenBtn.setAttribute('aria-pressed','false');
  // restore canvas sizing
  restoreCanvasSize();
}

// If native exit happens, also clear pseudo state
document.addEventListener('fullscreenchange', ()=>{ if(!isFullscreen() && pseudoActive) exitPseudoFullscreen(); });

// When fullscreen (native or pseudo) we want to size the canvas to available
// wrapper area minus controls. Use devicePixelRatio for crisp rendering.
function adjustCanvasForFullscreen(){
  if(!canvasWrapper || !canvas) return;
  // ensure controls are visible and inside wrapper
  if(touchControls && touchControls.parentNode !== canvasWrapper){
    try{ canvasWrapper.appendChild(touchControls); }catch(e){}
  }
  // compute available area inside wrapper
  const wrapRect = canvasWrapper.getBoundingClientRect();
  let controlsH = 0;
  if(touchControls){
    // make controls visible to measure
    touchControls.classList.remove('touch-hidden');
    const cr = touchControls.getBoundingClientRect();
    controlsH = cr.height || 0;
  }
  const availW = Math.max(100, Math.floor(wrapRect.width));
  const availH = Math.max(100, Math.floor(wrapRect.height - controlsH - 12));
  const dpr = window.devicePixelRatio || 1;
  // set CSS size and backing store size
  canvas.style.width = availW + 'px';
  canvas.style.height = availH + 'px';
  canvas.width = Math.max(100, Math.floor(availW * dpr));
  canvas.height = Math.max(100, Math.floor(availH * dpr));
  CELL = canvas.width / GRID;
  draw();
}

function restoreCanvasSize(){
  // revert to responsive behaviour
  resizeCanvas();
}

// call adjust when entering/exiting native fullscreen
document.addEventListener('fullscreenchange', ()=>{ if(isFullscreen()) adjustCanvasForFullscreen(); else restoreCanvasSize(); });
document.addEventListener('webkitfullscreenchange', ()=>{ if(isFullscreen()) adjustCanvasForFullscreen(); else restoreCanvasSize(); });

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // grid background
  ctx.fillStyle = '#071029';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // draw food
  // draw mandarin fruit (use image when available, fallback to circle)
  if(mandImg && mandImg.complete && mandImg.naturalWidth){
    const pad = Math.max(2, Math.floor(CELL*0.08));
    const w = Math.max(4, Math.floor(CELL - pad*2));
    ctx.drawImage(mandImg, Math.floor(food.x*CELL + pad), Math.floor(food.y*CELL + pad), w, w);
  } else {
    ctx.fillStyle = '#ff6666';
    drawCell(food.x, food.y);
  }

  // draw snake
  for(let i=0;i<snake.length;i++){
    ctx.fillStyle = i===0 ? '#7ce3ff' : '#2bb0d6';
    drawCell(snake[i].x, snake[i].y);
  }
}

function drawCell(x,y){
  ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
}

window.addEventListener('keydown', e=>{
  unlockAudio();
  if(e.key==='ArrowUp'){ setDirection(0,-1); playSound('turn'); }
  else if(e.key==='ArrowDown'){ setDirection(0,1); playSound('turn'); }
  else if(e.key==='ArrowLeft'){ setDirection(-1,0); playSound('turn'); }
  else if(e.key==='ArrowRight'){ setDirection(1,0); playSound('turn'); }
  else if(e.code==='Space'){ togglePause(); }
});

function setDirection(x,y){
  // prevent reversing directly
  if(dir.x === -x && dir.y === -y) return;
  dir = {x,y};
}

restartBtn.addEventListener('click', ()=>{ reset(); pauseBtn.textContent='Pause'; });
pauseBtn.addEventListener('click', ()=>{ togglePause(); });

function togglePause(){
  running = !running;
  pauseBtn.textContent = running ? 'Pause' : 'Resume';
}

// touch/swipe controls
let tStartX=0, tStartY=0;
window.addEventListener('touchstart', e=>{
  if(e.touches && e.touches.length===1){
    tStartX = e.touches[0].clientX; tStartY = e.touches[0].clientY;
  }
}, {passive:true});
window.addEventListener('touchend', e=>{
  if(!tStartX && !tStartY) return;
  const touch = e.changedTouches && e.changedTouches[0];
  if(!touch) return;
  const dx = touch.clientX - tStartX;
  const dy = touch.clientY - tStartY;
  const absX = Math.abs(dx), absY = Math.abs(dy);
  const threshold = 30; // px
  if(Math.max(absX, absY) < threshold) return;
  if(absX > absY){ // horizontal swipe
    setDirection(dx>0?1:-1, 0);
  } else {
    setDirection(0, dy>0?1:-1);
  }
  tStartX = 0; tStartY = 0;
}, {passive:true});

// on-screen buttons
if(touchControls){
  touchControls.querySelectorAll('.dir').forEach(btn=>{
    const cls = btn.classList;
    let d;
    if(cls.contains('up')) d = [0,-1];
    else if(cls.contains('down')) d = [0,1];
    else if(cls.contains('left')) d = [-1,0];
    else if(cls.contains('right')) d = [1,0];
    if(!d) return;
    const handler = (ev)=>{ ev.preventDefault(); setDirection(d[0], d[1]); };
    btn.addEventListener('touchstart', ev=>{ unlockAudio(); handler(ev); });
    btn.addEventListener('mousedown', ev=>{ unlockAudio(); handler(ev); });
  });
}

// initialize
// set initial slider display
// setup responsive canvas sizing
function resizeCanvas(){
  const padding = 32; // keep some margin
  const max = Math.min(480, Math.floor(window.innerWidth * 0.95));
  const size = Math.max(200, max - padding);
  canvas.width = size;
  canvas.height = size;
  CELL = canvas.width / GRID;
  draw();
}

window.addEventListener('resize', resizeCanvas);

// set initial slider display and unlock on first gesture
window.addEventListener('touchstart', ()=>unlockAudio(), {passive:true});
window.addEventListener('mousedown', ()=>unlockAudio(), {passive:true});

resizeCanvas();

// show start menu and prepare a preview (do not start until user picks)
if(startMenu){
  startMenu.classList.remove('hidden');
  console.log('Start menu displayed');
  // difficulty selection buttons in menu
  const menuBtns = Array.from(startMenu.querySelectorAll('.start-btn:not(.primary)'));
  // disable start button initially
  if(startBtn) startBtn.disabled = true;

  menuBtns.forEach(b=>{
    const diff = b.dataset.diff;
    const select = (ev)=>{
      if(ev && ev.preventDefault) ev.preventDefault();
      // highlight selection
      menuBtns.forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      // enable start button once a selection is made
      if(startBtn) startBtn.disabled = false;
      console.log('Difficulty selected (menu):', diff);
    };
    b.addEventListener('click', select);
    b.addEventListener('touchstart', select, {passive:false});
    b.addEventListener('pointerdown', select);
  });
  // start button: optionally request fullscreen first, then start
  if(startBtn){
    startBtn.addEventListener('click', async ()=>{
      const sel = menuBtns.find(x=>x.classList.contains('selected'));
      const diff = sel ? sel.dataset.diff : 'normal';
      console.log('Start pressed, selected difficulty:', diff);
      await maybeEnterFullscreenBeforeStart();
      startGameWithDifficulty(diff);
    });
  }
}
// draw an initial preview snake on canvas
snake = [{x: Math.floor(GRID/2), y: Math.floor(GRID/2)}];
CELL = canvas.width / GRID;
placeFood();
draw();