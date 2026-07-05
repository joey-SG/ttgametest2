import {
  BIG_BANG_BONUS,
  CHAIN,
  DROP,
  DROP_POOL_IDS,
  DROP_POOL_WEIGHTS,
  FX,
  HIGH_TIER_THRESHOLD,
  LAST_TIER_ID,
  OVERFLOW,
  PHYSICS,
  TIERS,
  WORLD,
} from '../config';
import { createBody, stepWorld, type Body } from './physics';
import type { Platform } from '../platform/types';

export type GameState = 'title' | 'playing' | 'gameover';

/** 물리 바디에 게임 전용 필드(오버플로우 타이머·juice 애니메이션 기준시각)를 얹은 확장 타입. */
export interface GameBody extends Body {
  aboveLineSince: number | null;
  /** 생성(드롭 또는 머지) 시각 — 렌더의 스케일 펀치(pop) 애니메이션 기준. */
  spawnedAt: number;
  /** 마지막 착지/급감속 감지 시각 — 렌더의 스쿼시 애니메이션 기준. null이면 없음. */
  impactAt: number | null;
}

export interface MergeFx {
  tier: number;
  x: number;
  y: number;
  bigBang: boolean;
  chainStage: number;
}

export interface DropFx {
  x: number;
  y: number;
  tier: number;
}

export interface ChainDisplay {
  stage: number;
  multiplier: number;
  expiresAt: number;
}

const bounds = { width: WORLD.width, height: WORLD.height };

function pickDropTier(): number {
  const total = DROP_POOL_WEIGHTS.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < DROP_POOL_IDS.length; i++) {
    roll -= DROP_POOL_WEIGHTS[i];
    if (roll <= 0) return DROP_POOL_IDS[i];
  }
  return DROP_POOL_IDS[DROP_POOL_IDS.length - 1];
}

function chainMultiplier(stage: number): number {
  const idx = Math.min(stage, CHAIN.multiplierByStage.length) - 1;
  return CHAIN.multiplierByStage[idx];
}

export class Game {
  state: GameState = 'title';
  bodies: GameBody[] = [];
  score = 0;
  highScore = 0;
  bestTierReached = 0;

  currentTier = pickDropTier();
  nextTier = pickDropTier();
  aimX = WORLD.width / 2;

  private dropLockUntil = 0;
  private lastMergeAt = -Infinity;
  private chainStage = 0;
  private lastWarningPulseAt = -Infinity;
  private readonly prevVy = new Map<number, number>();

  /** 렌더/fx 오케스트레이터(main.ts)가 매 프레임 드레인하는 1회성 이벤트 큐. */
  readonly mergeEvents: MergeFx[] = [];
  readonly dropEvents: DropFx[] = [];
  overflowWarning = false;
  /** 오버플로우 경고 반복 펄스(햅틱+비프)가 울릴 때마다 증가 — main.ts가 변화를 감지해 사운드 재생. */
  warningPulseCount = 0;

  constructor(private platform: Platform) {}

  async init(): Promise<void> {
    this.highScore = await this.platform.loadHighScore();
  }

  startTitle(): void {
    this.state = 'title';
  }

  startPlaying(): void {
    this.bodies = [];
    this.score = 0;
    this.bestTierReached = 0;
    this.chainStage = 0;
    this.lastMergeAt = -Infinity;
    this.lastWarningPulseAt = -Infinity;
    this.dropLockUntil = 0;
    this.overflowWarning = false;
    this.mergeEvents.length = 0;
    this.dropEvents.length = 0;
    this.currentTier = pickDropTier();
    this.nextTier = pickDropTier();
    this.state = 'playing';
  }

  restart(): void {
    this.startPlaying();
  }

  setAim(worldX: number): void {
    const radius = TIERS[this.currentTier].radius;
    this.aimX = clamp(worldX, radius, WORLD.width - radius);
  }

  tryDrop(now: number): void {
    if (this.state !== 'playing') return;
    if (now < this.dropLockUntil) return;

    const tier = TIERS[this.currentTier];
    const body: GameBody = {
      ...createBody(this.currentTier, tier.radius, this.aimX, DROP.spawnY),
      aboveLineSince: null,
      spawnedAt: now,
      impactAt: null,
    };
    this.bodies.push(body);
    this.bestTierReached = Math.max(this.bestTierReached, this.currentTier);
    this.dropLockUntil = now + DROP.cooldownMs;
    this.dropEvents.push({ x: body.x, y: body.y, tier: body.tier });

    this.currentTier = this.nextTier;
    this.nextTier = pickDropTier();

    this.platform.haptic('select');
  }

  update(now: number, dt: number): void {
    if (this.state !== 'playing') return;

    // 착지/급감속 감지용: 물리 스텝 전 속도를 기록해두고 스텝 후와 비교한다.
    this.prevVy.clear();
    for (const body of this.bodies) this.prevVy.set(body.id, body.vy);

    const merges = stepWorld(this.bodies, bounds, dt, PHYSICS);

    for (const body of this.bodies) {
      const before = this.prevVy.get(body.id);
      if (before !== undefined && before > FX.impactVyThreshold && body.vy < before * 0.35) {
        body.impactAt = now;
      }
    }

    this.processMerges(merges, now);
    this.updateOverflow(now);
  }

  private processMerges(
    merges: { a: Body; b: Body }[],
    now: number
  ): void {
    if (merges.length === 0) return;

    const removedIds = new Set<number>();

    for (const { a, b } of merges) {
      removedIds.add(a.id);
      removedIds.add(b.id);

      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const avgVx = (a.vx + b.vx) / 2;
      const avgVy = (a.vy + b.vy) / 2;

      // 체인 배율: 직전 머지로부터 윈도우 내면 단계 상승, 아니면 새 체인 시작.
      if (now - this.lastMergeAt <= CHAIN.windowMs) {
        this.chainStage += 1;
      } else {
        this.chainStage = 1;
      }
      this.lastMergeAt = now;
      const multiplier = chainMultiplier(this.chainStage);

      if (a.tier === LAST_TIER_ID) {
        // 블랙홀 + 블랙홀 = 빅뱅: 둘 다 소멸, 새 바디 없음, 보너스 점수.
        this.score += BIG_BANG_BONUS;
        this.mergeEvents.push({ tier: a.tier, x: midX, y: midY, bigBang: true, chainStage: this.chainStage });
        this.platform.haptic('combo');
        continue;
      }

      const newTier = a.tier + 1;
      const newTierConfig = TIERS[newTier];
      const newBody: GameBody = {
        ...createBody(newTier, newTierConfig.radius, midX, midY, avgVx, avgVy),
        aboveLineSince: null,
        spawnedAt: now,
        impactAt: null,
      };
      this.bodies.push(newBody);

      this.score += newTierConfig.score * multiplier;
      this.bestTierReached = Math.max(this.bestTierReached, newTier);
      this.mergeEvents.push({ tier: newTier, x: midX, y: midY, bigBang: false, chainStage: this.chainStage });
      this.platform.haptic(this.chainStage >= 3 || newTier >= HIGH_TIER_THRESHOLD ? 'combo' : 'success');
    }

    this.bodies = this.bodies.filter((body) => !removedIds.has(body.id));
  }

  private updateOverflow(now: number): void {
    let worstDuration = 0;

    for (const body of this.bodies) {
      if (body.y < WORLD.overflowY) {
        if (body.aboveLineSince === null) body.aboveLineSince = now;
        worstDuration = Math.max(worstDuration, now - body.aboveLineSince);
      } else {
        body.aboveLineSince = null;
      }
    }

    this.overflowWarning = worstDuration >= OVERFLOW.warnAtMs;

    // 경고 중엔 일정 간격으로 짧은 위험 햅틱을 반복 (docs/02 §9). 사운드 비프는 main.ts가
    // warningPulseCount 변화를 감지해 재생 — 여기선 게임 로직만 담당(오디오 직접 호출 금지).
    if (this.overflowWarning && now - this.lastWarningPulseAt >= FX.warningPulseIntervalMs) {
      this.lastWarningPulseAt = now;
      this.warningPulseCount += 1;
      this.platform.haptic('fail');
    }

    if (worstDuration >= OVERFLOW.gameOverMs) {
      this.triggerGameOver();
    }
  }

  private triggerGameOver(): void {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.platform.haptic('fail');

    if (this.score > this.highScore) {
      this.highScore = this.score;
      void this.platform.saveHighScore(this.highScore);
    }
  }

  currentChainDisplay(now: number): ChainDisplay | null {
    if (this.chainStage < 2) return null;
    const expiresAt = this.lastMergeAt + CHAIN.windowMs;
    if (now > expiresAt) return null;
    return { stage: this.chainStage, multiplier: chainMultiplier(this.chainStage), expiresAt };
  }

  bestTierName(): string {
    return TIERS[this.bestTierReached]?.name ?? TIERS[0].name;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
