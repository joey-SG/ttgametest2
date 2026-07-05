import { PHYSICS, WORLD } from './config';
import { Game } from './game/game';
import { createWebPlatform } from './platform/web';
import { draw } from './render';

const canvasEl = document.getElementById('game-canvas');
if (!(canvasEl instanceof HTMLCanvasElement)) {
  throw new Error('canvas#game-canvas를 찾을 수 없습니다.');
}
const canvas = canvasEl;

// 반환 타입을 non-null로 명시 — 중첩 함수(클로저) 안에서는 상위 스코프의
// null 체크에 의한 타입 좁히기가 유지되지 않는 TS 제약을 피하기 위함.
function getContext2D(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = target.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context를 생성할 수 없습니다.');
  }
  return context;
}
const ctx = getContext2D(canvas);

// 월드(360x640 고정 좌표계) → 화면 픽셀 변환. 데스크톱에서는 중앙 세로 프레임으로 letterbox.
let scale = 1;
let offsetX = 0;
let offsetY = 0;

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;

  scale = Math.min(cssWidth / WORLD.width, cssHeight / WORLD.height);
  offsetX = (cssWidth - WORLD.width * scale) / 2;
  offsetY = (cssHeight - WORLD.height * scale) / 2;

  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);

  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

function clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - offsetX) / scale,
    y: (clientY - rect.top - offsetY) / scale,
  };
}

const platform = createWebPlatform();
const game = new Game(platform);

let dragging = false;

function handlePointerDown(clientX: number, clientY: number): void {
  if (game.state === 'title') {
    game.startPlaying();
    return;
  }
  if (game.state === 'gameover') {
    game.restart();
    return;
  }

  const world = clientToWorld(clientX, clientY);
  dragging = true;
  game.setAim(world.x);
}

function handlePointerMove(clientX: number, clientY: number): void {
  if (!dragging || game.state !== 'playing') return;
  const world = clientToWorld(clientX, clientY);
  game.setAim(world.x);
}

function handlePointerUp(): void {
  if (!dragging) return;
  dragging = false;
  if (game.state === 'playing') {
    game.tryDrop(performance.now());
  }
}

// Pointer Events로 마우스+터치를 통합 처리 (touch-action: none과 병행해 스크롤/줌 차단).
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  handlePointerDown(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => {
  e.preventDefault();
  handlePointerMove(e.clientX, e.clientY);
});
canvas.addEventListener('pointerup', (e) => {
  e.preventDefault();
  handlePointerUp();
});
canvas.addEventListener('pointercancel', () => {
  dragging = false;
});

// 고정 타임스텝 누적기 (Fix Your Timestep 패턴) — 프레임 변동을 흡수해 물리를 결정적으로 유지.
const FIXED_DT_MS = PHYSICS.fixedDt * 1000;
let lastFrameTime = performance.now();
let accumulatorMs = 0;

function frame(now: number): void {
  const frameDt = Math.min(now - lastFrameTime, 250); // 탭 전환 등 큰 델타 클램프 (스파이럴 오브 데스 방지)
  lastFrameTime = now;
  accumulatorMs += frameDt;

  let steps = 0;
  while (accumulatorMs >= FIXED_DT_MS && steps < PHYSICS.maxStepsPerFrame) {
    game.update(now, PHYSICS.fixedDt);
    accumulatorMs -= FIXED_DT_MS;
    steps++;
  }

  draw(ctx, game, now);
  requestAnimationFrame(frame);
}

game.init().then(() => {
  requestAnimationFrame(frame);
});
