const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const restartBtn = document.getElementById('restart');
const pauseBtn = document.getElementById('pause');

const GRID = 20; // number of cells per row/col
let CELL; // pixel size of a cell (computed from canvas size)
let snake, dir, food, timer, speed, running, score;
let baseSpeed = 100; // ms per step from slider

const sensitivityEl = document.getElementById('sensitivity');
const sensitivityValueEl = document.getElementById('sensitivityValue');
const touchControls = document.getElementById('touch-controls');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const canvasWrapper = document.querySelector('.canvas-wrapper');

// WebAudio for short effects
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioCtx ? new AudioCtx() : null;
let audioUnlocked = false;

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

  fullscreenBtn.addEventListener('click', async (ev)=>{
    ev.preventDefault(); ev.stopPropagation();
    unlockAudio();
    try{
      if(!isFullscreen()){
        // prefer the wrapper, fallback to canvas
        const target = canvasWrapper || canvas;
        await requestFull(target);
      } else {
        await exitFull();
      }
    }catch(e){
      console.warn('Fullscreen toggle failed', e);
    }
  });

  // update the button icon when fullscreen state changes
  function onFullChange(){
    const fs = isFullscreen();
    // show different glyphs to indicate state
    fullscreenBtn.textContent = fs ? '⤡' : '⤢';
    fullscreenBtn.setAttribute('aria-pressed', fs ? 'true' : 'false');
  }

  document.addEventListener('fullscreenchange', onFullChange);
  document.addEventListener('webkitfullscreenchange', onFullChange);
  document.addEventListener('mozfullscreenchange', onFullChange);
  document.addEventListener('MSFullscreenChange', onFullChange);
  // ensure initial label
  updateFullscreenButton();
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // grid background
  ctx.fillStyle = '#071029';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // draw food
  ctx.fillStyle = '#ff6666';
  drawCell(food.x, food.y);

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

// sensitivity slider handling
sensitivityEl.addEventListener('input', (e)=>{
  baseSpeed = Number(e.target.value);
  sensitivityValueEl.textContent = baseSpeed;
  speed = computeSpeed();
  if(timer){ clearInterval(timer); timer = setInterval(step, speed); }
});

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
sensitivityValueEl.textContent = baseSpeed;
window.addEventListener('touchstart', ()=>unlockAudio(), {passive:true});
window.addEventListener('mousedown', ()=>unlockAudio(), {passive:true});

resizeCanvas();
reset();
draw();