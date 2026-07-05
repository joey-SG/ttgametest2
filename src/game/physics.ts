// 원형(circle) 전용 2D 물리 — 독립 모듈 (docs/03 §2).
// 고정 타임스텝 세미-임플리시트 오일러 + 서브스텝 + 위치 보정 + 임펄스 해소.
// 바디 수가 적으므로(<=수백) 브로드페이즈 없이 O(n^2) 전수 검사로 충분 (과설계 금지).

export interface Body {
  id: number;
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** 이번 스텝(들)에서 이미 머지 후보로 잡혔는지. 게임 로직이 실제 머지를 처리하고
   * 바디를 제거할 때까지 true로 유지 — "프레임당 바디 1회 머지" 쿨다운을 자연스럽게 보장. */
  pendingMerge: boolean;
}

export interface Bounds {
  width: number;
  height: number;
}

export interface PhysicsConfig {
  substeps: number;
  gravity: number;
  restitution: number;
  friction: number;
  positionCorrectionPercent: number;
  positionSlop: number;
}

export interface MergePair {
  a: Body;
  b: Body;
}

let nextBodyId = 1;

export function createBody(
  tier: number,
  radius: number,
  x: number,
  y: number,
  vx = 0,
  vy = 0
): Body {
  return { id: nextBodyId++, tier, x, y, vx, vy, radius, pendingMerge: false };
}

function mass(body: Body): number {
  return body.radius * body.radius; // 면적 비례 — 큰 천체일수록 무겁게
}

/** 고정 타임스텝 1회분을 substeps로 나눠 적분·충돌 해소한다.
 * 같은 티어 접촉 쌍을 찾아 반환한다 (실제 머지 생성/제거는 호출측 게임 로직 담당).
 *
 * 속도를 강제로 0에 스냅하는 "sleep" 단계는 두지 않는다 — 초기에 있었으나, 접촉한 두
 * 바디 중 위쪽을 무조건 supported로 표시하는 방식은 공중에서 서로 닿은 채 함께
 * 낙하하는 바디까지 정지시켜 클러스터가 서로를 붙잡고 크롤링하는 버그를 냈다. 낮은
 * 반발계수(restitution)와 위치 보정의 slop만으로 정착 시 지터가 없음을 시뮬레이션으로
 * 확인했고(8~15단 스택 모두 정착 후 1~2초간 위치 변화 ~0), 코드도 더 단순해 이 방식을
 * 채택했다 (Simplicity First). */
export function stepWorld(
  bodies: Body[],
  bounds: Bounds,
  dt: number,
  cfg: PhysicsConfig
): MergePair[] {
  const merges: MergePair[] = [];
  const subDt = dt / cfg.substeps;

  for (let s = 0; s < cfg.substeps; s++) {
    integrate(bodies, subDt, cfg.gravity);
    resolveWalls(bodies, bounds, cfg);
    resolveCollisions(bodies, cfg, merges);
    // 안전망: 극단적 질량비(예: 블랙홀이 작은 천체 더미를 짓누르는 경우) 원-원 위치
    // 보정이 벽 보정보다 늦게 실행돼 가벼운 바디를 경계 밖으로 밀어낼 수 있다.
    // 부드러운 반발/보정과 무관하게 위치만 강제로 경계 안쪽에 묶어 관통을 원천 차단.
    clampBounds(bodies, bounds);
  }

  return merges;
}

function clampBounds(bodies: Body[], bounds: Bounds): void {
  for (const b of bodies) {
    if (b.x - b.radius < 0) b.x = b.radius;
    if (b.x + b.radius > bounds.width) b.x = bounds.width - b.radius;
    if (b.y + b.radius > bounds.height) b.y = bounds.height - b.radius;
  }
}

function integrate(bodies: Body[], dt: number, gravity: number): void {
  for (const b of bodies) {
    b.vy += gravity * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
}

function resolveWalls(bodies: Body[], bounds: Bounds, cfg: PhysicsConfig): void {
  for (const b of bodies) {
    // 왼쪽 벽
    if (b.x - b.radius < 0) {
      const penetration = b.radius - b.x;
      b.x += correctionAmount(penetration, cfg);
      if (b.vx < 0) b.vx = -b.vx * cfg.restitution;
      b.vy *= 1 - cfg.friction;
    }
    // 오른쪽 벽
    if (b.x + b.radius > bounds.width) {
      const penetration = b.x + b.radius - bounds.width;
      b.x -= correctionAmount(penetration, cfg);
      if (b.vx > 0) b.vx = -b.vx * cfg.restitution;
      b.vy *= 1 - cfg.friction;
    }
    // 바닥
    if (b.y + b.radius > bounds.height) {
      const penetration = b.y + b.radius - bounds.height;
      b.y -= correctionAmount(penetration, cfg);
      if (b.vy > 0) b.vy = -b.vy * cfg.restitution;
      b.vx *= 1 - cfg.friction;
    }
  }
}

function correctionAmount(penetration: number, cfg: PhysicsConfig): number {
  const over = penetration - cfg.positionSlop;
  return over > 0 ? over * cfg.positionCorrectionPercent : 0;
}

function resolveCollisions(bodies: Body[], cfg: PhysicsConfig, merges: MergePair[]): void {
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];

      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let distSq = dx * dx + dy * dy;
      const radiusSum = a.radius + b.radius;

      if (distSq >= radiusSum * radiusSum) continue;

      let dist = Math.sqrt(distSq);
      if (dist < 1e-6) {
        // 완전히 겹친 예외 상황: 임의 방향으로 살짝 밀어 분리
        dx = 0;
        dy = -1;
        dist = 1e-6;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const penetration = radiusSum - dist;

      // 위치 보정 (역질량 비례 분배)
      const invMassA = 1 / mass(a);
      const invMassB = 1 / mass(b);
      const invMassSum = invMassA + invMassB;
      const correction = correctionAmount(penetration, cfg);
      if (correction > 0 && invMassSum > 0) {
        const corrX = (correction * nx) / invMassSum;
        const corrY = (correction * ny) / invMassSum;
        a.x -= corrX * invMassA;
        a.y -= corrY * invMassA;
        b.x += corrX * invMassB;
        b.y += corrY * invMassB;
      }

      // 임펄스 기반 속도 해소 (법선 방향)
      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const relVelAlongNormal = rvx * nx + rvy * ny;

      if (relVelAlongNormal < 0) {
        const jn = (-(1 + cfg.restitution) * relVelAlongNormal) / invMassSum;
        const jx = jn * nx;
        const jy = jn * ny;
        a.vx -= jx * invMassA;
        a.vy -= jy * invMassA;
        b.vx += jx * invMassB;
        b.vy += jy * invMassB;

        // 접선(마찰) 감쇠
        const tx = -ny;
        const ty = nx;
        const relVelAlongTangent = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
        const jt = -relVelAlongTangent * cfg.friction / invMassSum;
        a.vx -= jt * tx * invMassA;
        a.vy -= jt * ty * invMassA;
        b.vx += jt * tx * invMassB;
        b.vy += jt * ty * invMassB;
      }

      // 머지 후보 등록: 같은 티어 접촉, 둘 다 아직 머지 대기중이 아닐 때만
      if (a.tier === b.tier && !a.pendingMerge && !b.pendingMerge) {
        a.pendingMerge = true;
        b.pendingMerge = true;
        merges.push({ a, b });
      }
    }
  }
}
