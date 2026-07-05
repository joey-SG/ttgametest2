// 파티클 시스템 — 고정 크기 풀을 재사용해 프레임당 할당을 없앤다 (60fps 유지, docs/02 §7).

export type ParticleKind = 'dot' | 'ring';

interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxRadius: number; // ring 전용: life에 따라 radius가 이 값까지 확장
  life: number; // 남은 수명 (초)
  maxLife: number;
  color: string;
}

const POOL_SIZE = 240;
const pool: Particle[] = Array.from({ length: POOL_SIZE }, () => ({
  active: false,
  kind: 'dot',
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  radius: 0,
  maxRadius: 0,
  life: 0,
  maxLife: 1,
  color: '#ffffff',
}));

let cursor = 0;

function acquire(): Particle {
  // 라운드로빈으로 다음 슬롯을 재사용 — 풀이 가득 차도 가장 오래된 파티클을 덮어써 상한을 보장.
  const p = pool[cursor];
  cursor = (cursor + 1) % POOL_SIZE;
  return p;
}

/** 머지 등 접점에서 사방으로 퍼지는 점 파티클 버스트. */
export function spawnBurst(
  x: number,
  y: number,
  color: string,
  count: number,
  speed: number,
  life: number
): void {
  for (let i = 0; i < count; i++) {
    const p = acquire();
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const spd = speed * (0.5 + Math.random() * 0.5);
    p.active = true;
    p.kind = 'dot';
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * spd;
    p.vy = Math.sin(angle) * spd;
    p.radius = 2 + Math.random() * 2.5;
    p.maxRadius = p.radius;
    p.life = life * (0.7 + Math.random() * 0.3);
    p.maxLife = p.life;
    p.color = color;
  }
}

/** 고티어 머지/빅뱅용 확장 링 웨이브. */
export function spawnRing(x: number, y: number, color: string, maxRadius: number, life: number): void {
  const p = acquire();
  p.active = true;
  p.kind = 'ring';
  p.x = x;
  p.y = y;
  p.vx = 0;
  p.vy = 0;
  p.radius = maxRadius * 0.1;
  p.maxRadius = maxRadius;
  p.life = life;
  p.maxLife = life;
  p.color = color;
}

export function updateParticles(dt: number): void {
  for (const p of pool) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    if (p.kind === 'dot') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    } else {
      // ring: 시간에 따라 반지름이 maxRadius까지 확장
      const t = 1 - p.life / p.maxLife;
      p.radius = p.maxRadius * easeOutCubic(t);
    }
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D): void {
  for (const p of pool) {
    if (!p.active) continue;
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (p.kind === 'dot') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function easeOutCubic(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}
