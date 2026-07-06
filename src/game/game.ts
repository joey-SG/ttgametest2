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
  STORAGE_KEYS,
  TIERS,
  WORLD,
} from '../config';
import { createBody, stepWorld, type Body } from './physics';
import type { Platform } from '../platform/types';
import { emptyStats, loadStats, saveStats, type NovaStats } from '../stats';

/** 게임오버 시 스테이징되는 런 기록. 부활하면 폐기, 다음 런 시작 시 stats에 확정(docs/06 §4). */
interface StagedRun {
  score: number;
  durationMs: number;
  merges: number;
  maxChain: number;
  bestTier: number;
}

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

  /** 런당 1회 소비되는 광고 보상 플래그(docs/02 §5). 스킵(false)은 소비하지 않는다. */
  reviveUsed = false;
  doubleUsed = false;
  /** 첫판 힌트 표시 여부 — 첫 머지 성공 시 true로 고정되고 영구 저장된다(docs/05 §M3). */
  tutorialDone = false;
  stats: NovaStats = emptyStats();

  private dropLockUntil = 0;
  private lastMergeAt = -Infinity;
  private chainStage = 0;
  private lastWarningPulseAt = -Infinity;
  private readonly prevVy = new Map<number, number>();
  private runStartAt = 0;
  private runMergeCount = 0;
  private runMaxChainStage = 0;
  private stagedRun: StagedRun | null = null;
  private adInFlight = false;

  /** 렌더/fx 오케스트레이터(main.ts)가 매 프레임 드레인하는 1회성 이벤트 큐. */
  readonly mergeEvents: MergeFx[] = [];
  readonly dropEvents: DropFx[] = [];
  overflowWarning = false;
  /** 오버플로우 경고 반복 펄스(햅틱+비프)가 울릴 때마다 증가 — main.ts가 변화를 감지해 사운드 재생. */
  warningPulseCount = 0;

  constructor(private platform: Platform) {}

  async init(): Promise<void> {
    this.highScore = await this.platform.loadHighScore();
    this.stats = await loadStats(this.platform);
    this.tutorialDone = (await this.platform.getItem(STORAGE_KEYS.tutorialDone)) === 'true';
  }

  startTitle(): void {
    this.state = 'title';
  }

  startPlaying(now: number): void {
    // 직전 런이 부활 없이 끝났다면(게임오버 상태로 대기 중이었다면) 이 시점에 지표를 확정한다.
    this.confirmStagedRun();
    this.stats.restarts += 1;
    saveStats(this.platform, this.stats);

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
    this.reviveUsed = false;
    this.doubleUsed = false;
    this.adInFlight = false;
    this.runStartAt = now;
    this.runMergeCount = 0;
    this.runMaxChainStage = 0;
    this.state = 'playing';
  }

  restart(now: number): void {
    this.startPlaying(now);
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
      this.runMergeCount += 1;

      if (!this.tutorialDone) {
        this.tutorialDone = true;
        void this.platform.setItem(STORAGE_KEYS.tutorialDone, 'true');
      }

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
      this.runMaxChainStage = Math.max(this.runMaxChainStage, this.chainStage);
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
      this.triggerGameOver(now);
    }
  }

  private triggerGameOver(now: number): void {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.platform.haptic('fail');

    if (this.score > this.highScore) {
      this.highScore = this.score;
      void this.platform.saveHighScore(this.highScore);
    }

    // 지표는 즉시 확정하지 않고 스테이징만 한다 — 부활하면 폐기, 다음 런 시작 시 확정(docs/06 §4).
    this.stagedRun = {
      score: this.score,
      durationMs: now - this.runStartAt,
      merges: this.runMergeCount,
      maxChain: this.runMaxChainStage,
      bestTier: this.bestTierReached,
    };
  }

  /** 광고 완주 시 하위 3티어 전체 + 오버플로우 라인 위 천체 제거, 점수·보드 유지, 배율 리셋(docs/02 §4). */
  private performRevive(): void {
    this.bodies = this.bodies.filter((body) => body.tier > 2 && body.y >= WORLD.overflowY);
    this.chainStage = 0;
    this.lastMergeAt = -Infinity;
    this.lastWarningPulseAt = -Infinity;
    this.overflowWarning = false;
    this.dropLockUntil = 0;
    this.state = 'playing';
  }

  /**
   * 런당 1회. 스킵(완주 실패)은 소비하지 않는다. 노출/수락 지표는 즉시 기록.
   * 2배를 이미 사용한 런에서는 허용하지 않는다 — "2배는 런의 최종 정산" 정책(부활→2배는 허용,
   * 2배→부활은 불허해 2배가 항상 진짜 최종 점수에 걸리게 한다).
   */
  async reviveWithAd(): Promise<boolean> {
    if (this.state !== 'gameover' || this.reviveUsed || this.doubleUsed || this.adInFlight) return false;
    this.adInFlight = true;
    try {
      this.stats.reviveShown += 1;
      saveStats(this.platform, this.stats);

      const completed = await this.platform.showRewardedAd('revive');
      if (!completed) return false;

      this.stats.reviveAccepted += 1;
      saveStats(this.platform, this.stats);

      this.reviveUsed = true;
      this.stagedRun = null; // 런이 계속되므로 스테이징된 게임오버 기록은 폐기.
      this.performRevive();
      this.platform.haptic('success');
      return true;
    } finally {
      this.adInFlight = false;
    }
  }

  /** 런당 1회. 최종 점수를 2배로 하고 최고점수를 재평가한다(docs/02 §5). */
  async doubleScoreWithAd(): Promise<boolean> {
    if (this.state !== 'gameover' || this.doubleUsed || this.adInFlight) return false;
    this.adInFlight = true;
    try {
      this.stats.doubleShown += 1;
      saveStats(this.platform, this.stats);

      const completed = await this.platform.showRewardedAd('double');
      if (!completed) return false;

      this.stats.doubleAccepted += 1;
      saveStats(this.platform, this.stats);

      this.doubleUsed = true;
      this.score *= 2;
      if (this.stagedRun) this.stagedRun.score = this.score;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        void this.platform.saveHighScore(this.highScore);
      }
      return true;
    } finally {
      this.adInFlight = false;
    }
  }

  /**
   * 게임오버 화면에서 탭을 닫거나 백그라운드로 전환되는 경우를 위한 안전망 — main.ts가
   * pagehide/visibilitychange에서 호출한다. 게임오버 상태가 아니거나 이미 확정됐으면 no-op이므로
   * 다음 startPlaying()의 confirmStagedRun() 호출과 이중 확정될 일은 없다.
   */
  flushStagedRun(): void {
    if (this.state !== 'gameover') return;
    this.confirmStagedRun();
  }

  /** 스테이징된 런 기록을 stats에 합산 — 다음 런 시작 시 호출(docs/06 §4). */
  private confirmStagedRun(): void {
    const run = this.stagedRun;
    if (!run) return;
    this.stats.totalRuns += 1;
    this.stats.totalScore += run.score;
    this.stats.totalDurationMs += run.durationMs;
    this.stats.totalMerges += run.merges;
    this.stats.maxChain = Math.max(this.stats.maxChain, run.maxChain);
    this.stats.tierReachedCounts[run.bestTier] = (this.stats.tierReachedCounts[run.bestTier] ?? 0) + 1;
    this.stagedRun = null;
    saveStats(this.platform, this.stats);
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
