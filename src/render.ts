import { TIERS, WORLD } from './config';
import type { Game } from './game/game';
import type { GameBody } from './game/game';

// M1은 기능 검증용 단순 렌더 (절차 그라디언트 원 + 티어 색 구분).
// 표정·파티클·글로우 등 juice는 M2에서 별도 fx 모듈로 추가한다.

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

export function draw(ctx: CanvasRenderingContext2D, game: Game, now: number): void {
  drawBackground(ctx);

  if (game.state === 'title') {
    drawTitle(ctx, game);
    return;
  }

  drawOverflowLine(ctx, game, now);
  for (const body of game.bodies) {
    drawBody(ctx, body);
  }
  drawHud(ctx, game, now);

  if (game.state === 'gameover') {
    drawGameOver(ctx, game);
  }
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

function drawBody(ctx: CanvasRenderingContext2D, body: GameBody): void {
  const tier = TIERS[body.tier];
  const gradient = ctx.createRadialGradient(
    body.x - body.radius * 0.35,
    body.y - body.radius * 0.35,
    body.radius * 0.1,
    body.x,
    body.y,
    body.radius
  );
  gradient.addColorStop(0, lighten(tier.color, 0.35));
  gradient.addColorStop(1, tier.color);

  ctx.save();
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.stroke();
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
    ctx.fillStyle = '#ffcf4d';
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

  ctx.font = '600 16px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('탭하여 다시하기', WORLD.width / 2, WORLD.height * 0.32 + 150);
  ctx.restore();
}

function lighten(hex: string, amount: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `rgb(${lr}, ${lg}, ${lb})`;
}
