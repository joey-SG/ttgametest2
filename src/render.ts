import { CHAIN_COLORS, FX, LAST_TIER_ID, TIERS, WORLD } from './config';
import type { Game } from './game/game';
import type { GameBody } from './game/game';
import { drawParticles } from './fx/particles';
import { getShakeOffset } from './fx/shake';
import { getEdgeGlow, getWhiteout } from './fx/glow';

// Canvas 2D 렌더. 절차 그라디언트 원 + 티어 색 구분(M1) 위에 표정·티어 시그니처·
// 파티클/글로우/셰이크·트레일·스쿼시 등 juice를 얹는다(M2). 이미지 에셋 0.

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
}

const STAR_COUNT = 60;
const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
  x: Math.random() * WORLD.width,
  y: Math.random() * WORLD.height,
  r: Math.random() * 1.2 + 0.3,
  a: Math.random() * 0.5 + 0.3,
}));

export function draw(
  ctx: CanvasRenderingContext2D,
  game: Game,
  now: number,
  statsOverlayOpen = false
): void {
  const shake = getShakeOffset();
  ctx.save();
  ctx.translate(shake.x, shake.y);

  drawBackground(ctx);

  if (game.state === 'title') {
    drawTitle(ctx, game);
    if (statsOverlayOpen) drawStatsOverlay(ctx, game);
    ctx.restore();
    return;
  }

  drawOverflowHeartbeat(ctx, game, now);
  drawOverflowLine(ctx, game, now);

  for (const body of game.bodies) {
    drawTrail(ctx, body);
  }
  for (const body of game.bodies) {
    drawBody(ctx, body, now);
  }

  drawParticles(ctx);
  drawEdgeGlow(ctx);
  drawWhiteout(ctx);

  drawLadder(ctx, game);
  drawHud(ctx, game, now);

  if (game.state === 'playing' && !game.tutorialDone) {
    drawTutorialHint(ctx);
  }

  if (game.state === 'gameover') {
    drawGameOver(ctx, game);
  }

  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  for (const star of stars) {
    ctx.globalAlpha = star.a;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawOverflowLine(ctx: CanvasRenderingContext2D, game: Game, now: number): void {
  const y = WORLD.overflowY;
  const blink = game.overflowWarning ? 0.5 + 0.5 * Math.sin(now / 90) : 0.35;

  ctx.save();
  ctx.strokeStyle = game.overflowWarning ? `rgba(255,80,80,${blink})` : 'rgba(120,140,255,0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(WORLD.width, y);
  ctx.stroke();
  ctx.restore();
}

/** 오버플로우 경고 중 화면 전체에 심장박동처럼 붉게 펄스 (시간의 순수 함수, 상태 불필요). */
function drawOverflowHeartbeat(ctx: CanvasRenderingContext2D, game: Game, now: number): void {
  if (!game.overflowWarning) return;
  const pulse = (Math.sin(now / 180) + 1) / 2;
  ctx.save();
  ctx.globalAlpha = 0.12 + pulse * 0.16;
  const gradient = ctx.createRadialGradient(
    WORLD.width / 2,
    WORLD.height / 2,
    WORLD.height * 0.25,
    WORLD.width / 2,
    WORLD.height / 2,
    WORLD.height * 0.78
  );
  gradient.addColorStop(0, 'rgba(255,30,30,0)');
  gradient.addColorStop(1, 'rgba(255,30,30,0.9)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.restore();
}

/** 빠르게 움직이는 바디 뒤로 옅어지는 잔상 몇 개 — 히스토리 버퍼 없이 현재 속도만으로 근사. */
function drawTrail(ctx: CanvasRenderingContext2D, body: GameBody): void {
  const speed = Math.hypot(body.vx, body.vy);
  if (speed < 150) return;

  const dirX = -body.vx / speed;
  const dirY = -body.vy / speed;
  const steps = 3;
  const speedAlpha = Math.min(1, speed / 700);

  for (let i = 1; i <= steps; i++) {
    const dist = i * body.radius * 0.4;
    const alpha = speedAlpha * 0.3 * (1 - i / (steps + 1));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(body.x + dirX * dist, body.y + dirY * dist, body.radius * (1 - i * 0.15), 0, Math.PI * 2);
    ctx.fillStyle = TIERS[body.tier].color;
    ctx.fill();
    ctx.restore();
  }
}

function drawBody(ctx: CanvasRenderingContext2D, body: GameBody, now: number): void {
  const tier = TIERS[body.tier];
  const pop = popScale(now - body.spawnedAt);
  const squash = body.impactAt !== null ? squashFactors(now - body.impactAt) : { sx: 1, sy: 1 };

  ctx.save();
  ctx.translate(body.x, body.y);
  ctx.scale(pop * squash.sx, pop * squash.sy);

  drawTierSignature(ctx, body, now);

  const gradient = ctx.createRadialGradient(
    -body.radius * 0.35,
    -body.radius * 0.35,
    body.radius * 0.1,
    0,
    0,
    body.radius
  );
  gradient.addColorStop(0, lighten(tier.color, 0.35));
  gradient.addColorStop(1, tier.color);

  ctx.beginPath();
  ctx.arc(0, 0, body.radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.stroke();

  drawFace(ctx, body.radius, body.tier === LAST_TIER_ID);

  ctx.restore();
}

/** 점 눈 + 입 커브 — Suika의 "귀여움" 요인을 절차 드로잉으로 재현 (docs/02 §6). */
function drawFace(ctx: CanvasRenderingContext2D, radius: number, light: boolean): void {
  const faceColor = light ? 'rgba(255,255,255,0.85)' : 'rgba(10,10,20,0.85)';
  const eyeOffsetX = radius * 0.32;
  const eyeOffsetY = -radius * 0.08;
  const eyeRadius = Math.max(1.1, radius * 0.09);

  ctx.fillStyle = faceColor;
  ctx.beginPath();
  ctx.arc(-eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
  ctx.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();

  const mouthY = radius * 0.18;
  const mouthWidth = radius * 0.26;
  ctx.beginPath();
  ctx.strokeStyle = faceColor;
  ctx.lineWidth = Math.max(1, radius * 0.06);
  ctx.lineCap = 'round';
  ctx.moveTo(-mouthWidth, mouthY);
  ctx.quadraticCurveTo(0, mouthY + radius * 0.22, mouthWidth, mouthY);
  ctx.stroke();
}

/** 티어 시그니처(단순 도형): 토성 고리·태양 코로나·적색거성 펄스·블랙홀 강착원반 (docs/02 §6). */
function drawTierSignature(ctx: CanvasRenderingContext2D, body: GameBody, now: number): void {
  switch (body.tier) {
    case 7: {
      // 토성 고리
      ctx.save();
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, body.radius * 1.7, body.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(232,192,120,0.55)';
      ctx.lineWidth = body.radius * 0.14;
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 8: {
      // 태양 코로나 — 완만하게 숨쉬는 글로우
      const pulse = 1 + Math.sin(now / 500) * 0.06;
      const glowRadius = body.radius * 1.8 * pulse;
      const gradient = ctx.createRadialGradient(0, 0, body.radius * 0.7, 0, 0, glowRadius);
      gradient.addColorStop(0, 'rgba(255,207,77,0.45)');
      gradient.addColorStop(1, 'rgba(255,207,77,0)');
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      break;
    }
    case 9: {
      // 적색거성 — 더 빠른 펄스
      const pulse = 1 + Math.sin(now / 320) * 0.1;
      const glowRadius = body.radius * 1.4 * pulse;
      const gradient = ctx.createRadialGradient(0, 0, body.radius * 0.8, 0, 0, glowRadius);
      gradient.addColorStop(0, 'rgba(255,107,77,0.4)');
      gradient.addColorStop(1, 'rgba(255,107,77,0)');
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      break;
    }
    case 10: {
      // 블랙홀 강착원반 — 서서히 회전
      const angle = (now / 4000) % Math.PI;
      ctx.save();
      ctx.rotate(angle);
      const diskGradient = ctx.createLinearGradient(-body.radius * 1.9, 0, body.radius * 1.9, 0);
      diskGradient.addColorStop(0, 'rgba(255,180,90,0)');
      diskGradient.addColorStop(0.5, 'rgba(255,200,120,0.85)');
      diskGradient.addColorStop(1, 'rgba(255,180,90,0)');
      ctx.beginPath();
      ctx.ellipse(0, 0, body.radius * 1.9, body.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = diskGradient;
      ctx.lineWidth = body.radius * 0.16;
      ctx.stroke();
      ctx.restore();
      break;
    }
    default:
      break;
  }
}

/** 머지로 생성된 새 천체의 스케일 펀치(팝) — 감쇠 진동으로 살짝 오버슈트 후 1로 수렴. */
function popScale(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= FX.popDurationMs) return 1;
  const t = elapsedMs / FX.popDurationMs;
  const damp = Math.exp(-t * 6);
  return 1 + damp * Math.sin(t * Math.PI * 2.2) * 0.25;
}

/** 착지/급감속 시 미세 스쿼시(가로로 눌리고 세로로 펴짐) — 감쇠 후 1로 수렴. */
function squashFactors(elapsedMs: number): { sx: number; sy: number } {
  if (elapsedMs < 0 || elapsedMs >= FX.squashDurationMs) return { sx: 1, sy: 1 };
  const t = elapsedMs / FX.squashDurationMs;
  const damp = Math.exp(-t * 5);
  const amount = damp * Math.sin(t * Math.PI) * 0.22;
  return { sx: 1 + amount, sy: 1 - amount };
}

function drawEdgeGlow(ctx: CanvasRenderingContext2D): void {
  const glow = getEdgeGlow();
  if (glow.intensity <= 0.01) return;
  ctx.save();
  const gradient = ctx.createRadialGradient(
    WORLD.width / 2,
    WORLD.height / 2,
    Math.min(WORLD.width, WORLD.height) * 0.3,
    WORLD.width / 2,
    WORLD.height / 2,
    Math.max(WORLD.width, WORLD.height) * 0.75
  );
  gradient.addColorStop(0, hexToRgba(glow.color, 0));
  gradient.addColorStop(1, hexToRgba(glow.color, Math.min(1, glow.intensity) * 0.6));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.restore();
}

function drawWhiteout(ctx: CanvasRenderingContext2D): void {
  const whiteout = getWhiteout();
  if (whiteout <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, whiteout);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.restore();
}

/** 진화 사다리 미니 UI — 화면 왼쪽에 작게, 도달한 티어를 밝혀 표시 (docs/02 §10). */
function drawLadder(ctx: CanvasRenderingContext2D, game: Game): void {
  const x = 14;
  const spacing = 15;
  const topY = WORLD.height * 0.36;

  ctx.save();
  for (let tierId = LAST_TIER_ID; tierId >= 0; tierId--) {
    const y = topY + (LAST_TIER_ID - tierId) * spacing;
    const reached = tierId <= game.bestTierReached;
    ctx.globalAlpha = reached ? 0.9 : 0.22;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = TIERS[tierId].color;
    ctx.fill();
    // 미도달 상태에도 옅은 테두리를 둬서 블랙홀처럼 어두운 색이 배경에 묻히지 않게 한다.
    ctx.lineWidth = 1;
    ctx.strokeStyle = reached ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)';
    ctx.stroke();
  }
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, game: Game, now: number): void {
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${game.score}`, 12, 10);

  ctx.font = '400 12px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`최고 ${game.highScore}`, 12, 36);

  const chain = game.currentChainDisplay(now);
  if (chain) {
    ctx.font = '600 16px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = chainColor(chain.stage);
    ctx.textAlign = 'center';
    ctx.fillText(`체인 x${chain.multiplier}`, WORLD.width / 2, 12);
    ctx.textAlign = 'left';
  }

  // 다음 천체 미리보기
  const previewTier = TIERS[game.nextTier];
  const previewX = WORLD.width - 28;
  const previewY = 30;
  ctx.font = '400 10px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'center';
  ctx.fillText('다음', previewX, previewY - 22);
  ctx.beginPath();
  ctx.arc(previewX, previewY, Math.min(previewTier.radius * 0.35, 16), 0, Math.PI * 2);
  ctx.fillStyle = previewTier.color;
  ctx.fill();
  ctx.textAlign = 'left';

  // 현재 조준 천체 (드롭 예정 위치)
  const aimTier = TIERS[game.currentTier];
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(game.aimX, 44, aimTier.radius, 0, Math.PI * 2);
  ctx.fillStyle = aimTier.color;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawTitle(ctx: CanvasRenderingContext2D, game: Game): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 42px system-ui, -apple-system, sans-serif';
  ctx.fillText('NOVA', WORLD.width / 2, WORLD.height * 0.36);

  ctx.font = '400 16px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('탭하여 시작', WORLD.width / 2, WORLD.height * 0.36 + 56);

  ctx.font = '400 13px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(`최고 점수 ${game.highScore}`, WORLD.width / 2, WORLD.height * 0.36 + 90);
  ctx.restore();

  drawStatsButton(ctx);
}

export interface GameOverButton {
  id: 'restart' | 'revive' | 'double' | 'share';
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAMEOVER_BUTTON_W = 220;
const GAMEOVER_BUTTON_H = 46;
const GAMEOVER_BUTTON_GAP = 14;
const GAMEOVER_BUTTONS_TOP = WORLD.height * 0.32 + 124;

/** 게임오버 버튼 목록(다시하기/광고 부활/2배/공유). 사용된 광고 보상 버튼은 숨긴다(docs/02 §5). */
export function getGameOverButtons(game: Game): GameOverButton[] {
  const defs: { id: GameOverButton['id']; label: string }[] = [{ id: 'restart', label: '다시하기' }];
  if (!game.reviveUsed) defs.push({ id: 'revive', label: '광고 보고 부활' });
  if (!game.doubleUsed) defs.push({ id: 'double', label: '광고 보고 점수 2배' });
  defs.push({ id: 'share', label: '공유' });

  const x = (WORLD.width - GAMEOVER_BUTTON_W) / 2;
  return defs.map((def, i) => ({
    ...def,
    x,
    y: GAMEOVER_BUTTONS_TOP + i * (GAMEOVER_BUTTON_H + GAMEOVER_BUTTON_GAP),
    w: GAMEOVER_BUTTON_W,
    h: GAMEOVER_BUTTON_H,
  }));
}

/** 게임오버 버튼 히트테스트(월드 좌표) — main.ts의 포인터 핸들러가 호출. */
export function hitTestGameOverButton(game: Game, x: number, y: number): GameOverButton | null {
  for (const btn of getGameOverButtons(game)) {
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) return btn;
  }
  return null;
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGameOverButton(ctx: CanvasRenderingContext2D, btn: GameOverButton): void {
  const isAdButton = btn.id === 'revive' || btn.id === 'double';
  ctx.save();
  ctx.beginPath();
  roundedRectPath(ctx, btn.x, btn.y, btn.w, btn.h, btn.h / 2);
  ctx.fillStyle = isAdButton ? 'rgba(255,207,77,0.16)' : 'rgba(255,255,255,0.1)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = isAdButton ? 'rgba(255,207,77,0.65)' : 'rgba(255,255,255,0.35)';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 16px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
  ctx.restore();
}

function drawGameOver(ctx: CanvasRenderingContext2D, game: Game): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 28px system-ui, -apple-system, sans-serif';
  ctx.fillText('게임 오버', WORLD.width / 2, WORLD.height * 0.32);

  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`점수 ${game.score}`, WORLD.width / 2, WORLD.height * 0.32 + 44);

  ctx.font = '400 14px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = game.score >= game.highScore ? '#ffcf4d' : 'rgba(255,255,255,0.7)';
  ctx.fillText(
    game.score >= game.highScore ? '최고 기록 갱신!' : `최고 점수 ${game.highScore}`,
    WORLD.width / 2,
    WORLD.height * 0.32 + 74
  );

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`최고 도달: ${game.bestTierName()}`, WORLD.width / 2, WORLD.height * 0.32 + 98);

  for (const btn of getGameOverButtons(game)) {
    drawGameOverButton(ctx, btn);
  }
  ctx.restore();
}

/** 첫판 힌트 — 첫 머지 성공 전까지 조준 프리뷰 위에 1줄 표시(docs/05 §M3). */
function drawTutorialHint(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '400 13px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('← 드래그해서 조준, 손을 떼면 드롭 →', WORLD.width / 2, WORLD.overflowY + 26);
  ctx.restore();
}

export const STATS_BUTTON = { x: WORLD.width - 50, y: 14, w: 36, h: 30 };

/** 타이틀 화면의 📊 지표 버튼 히트테스트(월드 좌표). */
export function hitTestStatsButton(x: number, y: number): boolean {
  return (
    x >= STATS_BUTTON.x &&
    x <= STATS_BUTTON.x + STATS_BUTTON.w &&
    y >= STATS_BUTTON.y &&
    y <= STATS_BUTTON.y + STATS_BUTTON.h
  );
}

function drawStatsButton(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.beginPath();
  roundedRectPath(ctx, STATS_BUTTON.x, STATS_BUTTON.y, STATS_BUTTON.w, STATS_BUTTON.h, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '16px system-ui, -apple-system, sans-serif';
  ctx.fillText('📊', STATS_BUTTON.x + STATS_BUTTON.w / 2, STATS_BUTTON.y + STATS_BUTTON.h / 2 + 1);
  ctx.restore();
}

/** 로컬 지표 심플 오버레이(docs/06 §4) — 타이틀 화면에서 📊 버튼으로 열고 탭하면 닫힌다. */
function drawStatsOverlay(ctx: CanvasRenderingContext2D, game: Game): void {
  const stats = game.stats;
  const avgScore = stats.totalRuns > 0 ? Math.round(stats.totalScore / stats.totalRuns) : 0;
  const avgDurationSec = stats.totalRuns > 0 ? Math.round((stats.totalDurationMs / stats.totalRuns / 100)) / 10 : 0;
  const avgMerges = stats.totalRuns > 0 ? Math.round((stats.totalMerges / stats.totalRuns) * 10) / 10 : 0;
  const reviveRate = stats.reviveShown > 0 ? Math.round((stats.reviveAccepted / stats.reviveShown) * 100) : 0;
  const doubleRate = stats.doubleShown > 0 ? Math.round((stats.doubleAccepted / stats.doubleShown) * 100) : 0;

  let bestTierId = 0;
  for (let i = 0; i < stats.tierReachedCounts.length; i++) {
    if (stats.tierReachedCounts[i] > 0) bestTierId = i;
  }

  const lines = [
    `완료된 런: ${stats.totalRuns}`,
    `평균 점수: ${avgScore}`,
    `평균 런 길이: ${avgDurationSec}s`,
    `런당 평균 머지: ${avgMerges}`,
    `최대 체인: x${Math.max(1, stats.maxChain)}`,
    `최고 도달 티어: ${TIERS[bestTierId]?.name ?? TIERS[0].name}`,
    `재도전 횟수: ${stats.restarts}`,
    `부활 광고 수락률: ${reviveRate}% (${stats.reviveAccepted}/${stats.reviveShown})`,
    `2배 광고 수락률: ${doubleRate}% (${stats.doubleAccepted}/${stats.doubleShown})`,
  ];

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 20px system-ui, -apple-system, sans-serif';
  ctx.fillText('로컬 지표', WORLD.width / 2, 64);

  ctx.font = '400 14px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  lines.forEach((line, i) => {
    ctx.fillText(line, WORLD.width / 2, 112 + i * 28);
  });

  ctx.font = '400 13px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('탭하여 닫기', WORLD.width / 2, WORLD.height - 36);
  ctx.restore();
}

function chainColor(stage: number): string {
  const idx = Math.min(stage, CHAIN_COLORS.length) - 1;
  return CHAIN_COLORS[idx];
}

function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `rgb(${lr}, ${lg}, ${lb})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.substring(0, 2), 16),
    g: parseInt(value.substring(2, 4), 16),
    b: parseInt(value.substring(4, 6), 16),
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
