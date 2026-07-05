import { CHAIN_COLORS, FX, HIGH_TIER_THRESHOLD, PHYSICS, TIERS, WORLD } from './config';
import { Game, type DropFx, type MergeFx } from './game/game';
import { createWebPlatform } from './platform/web';
import { draw } from './render';
import {
  ensureAudioResumed,
  playBigBang,
  playDropTick,
  playGameOverBoom,
  playMergeSound,
  playWarningBeep,
} from './audio';
import { spawnBurst, spawnRing, updateParticles } from './fx/particles';
import { triggerShake, updateShake } from './fx/shake';
import { triggerEdgeGlow, triggerWhiteout, updateGlow } from './fx/glow';

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
  ensureAudioResumed(); // iOS는 사용자 제스처 안에서 resume()해야 소리가 난다 (docs/03 §3.4).
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

// 게임 로직(game.ts)은 물리·점수·상태만 다루고 플랫폼/오디오 API를 직접 호출하지 않는다.
// mergeEvents/dropEvents 큐를 여기서 드레인해 파티클·셰이크·글로우·사운드를 트리거한다.

function processMergeFx(fx: MergeFx): void {
  const tier = TIERS[fx.tier];

  if (fx.bigBang) {
    spawnBurst(fx.x, fx.y, '#ffffff', FX.particleBurstCount * 2, FX.particleBurstSpeed * 1.6, FX.particleLifeSec * 1.4);
    spawnRing(fx.x, fx.y, '#ffffff', tier.radius * FX.ringRadiusScale * 1.6, FX.ringLifeSec * 1.6);
    triggerWhiteout(FX.edgeGlowBigBangIntensity);
    triggerShake(FX.shakeBigBang);
    playBigBang();
    return;
  }

  spawnBurst(fx.x, fx.y, tier.color, FX.particleBurstCount, FX.particleBurstSpeed, FX.particleLifeSec);

  const isChain = fx.chainStage >= 2;
  const glowColor = isChain ? CHAIN_COLORS[Math.min(fx.chainStage, CHAIN_COLORS.length) - 1] : tier.color;
  triggerEdgeGlow(glowColor, isChain ? FX.edgeGlowChainIntensity : FX.edgeGlowMergeIntensity);

  if (fx.tier >= HIGH_TIER_THRESHOLD) {
    triggerShake(FX.shakeHighTier);
    spawnRing(fx.x, fx.y, tier.color, tier.radius * FX.ringRadiusScale, FX.ringLifeSec);
  }

  playMergeSound(fx.tier, fx.chainStage);
}

function processDropFx(_fx: DropFx): void {
  playDropTick();
}

// 고정 타임스텝 누적기 (Fix Your Timestep 패턴) — 프레임 변동을 흡수해 물리를 결정적으로 유지.
const FIXED_DT_MS = PHYSICS.fixedDt * 1000;
let lastFrameTime = performance.now();
let accumulatorMs = 0;

function frame(now: number): void {
  const frameDt = Math.min(now - lastFrameTime, 250); // 탭 전환 등 큰 델타 클램프 (스파이럴 오브 데스 방지)
  lastFrameTime = now;
  accumulatorMs += frameDt;

  const prevState = game.state;
  const prevWarningPulseCount = game.warningPulseCount;

  let steps = 0;
  while (accumulatorMs >= FIXED_DT_MS && steps < PHYSICS.maxStepsPerFrame) {
    game.update(now, PHYSICS.fixedDt);
    accumulatorMs -= FIXED_DT_MS;
    steps++;
  }

  while (game.mergeEvents.length > 0) {
    processMergeFx(game.mergeEvents.shift()!);
  }
  while (game.dropEvents.length > 0) {
    processDropFx(game.dropEvents.shift()!);
  }
  if (game.warningPulseCount !== prevWarningPulseCount) {
    playWarningBeep();
  }
  if (prevState === 'playing' && game.state === 'gameover') {
    playGameOverBoom();
  }

  const frameDtSec = frameDt / 1000;
  updateParticles(frameDtSec);
  updateShake(frameDtSec);
  updateGlow(frameDtSec);

  draw(ctx, game, now);
  requestAnimationFrame(frame);
}

game.init().then(() => {
  requestAnimationFrame(frame);
});
