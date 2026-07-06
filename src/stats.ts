// 로컬 지표 nova.stats (docs/06 §4). 집계 규칙: 런 기록은 게임오버 시 스테이징(game.ts),
// 부활하면 폐기, 다음 런 시작 시 확정(confirmStagedRun). 광고 노출/수락은 즉시 기록.
// 서버 없이 localStorage 기반 KV — Platform.setItem/getItem 경유(직접 호출 금지).

import { STORAGE_KEYS, TIERS } from './config';
import type { Platform } from './platform/types';

export interface NovaStats {
  totalRuns: number; // 부활 없이 종료된(확정된) 런 수
  totalScore: number;
  totalDurationMs: number;
  totalMerges: number;
  maxChain: number;
  tierReachedCounts: number[]; // index = tier id, 확정된 런의 최고 도달 티어 분포
  restarts: number; // 누적 재도전(런 시작) 횟수
  reviveShown: number;
  reviveAccepted: number;
  doubleShown: number;
  doubleAccepted: number;
}

export function emptyStats(): NovaStats {
  return {
    totalRuns: 0,
    totalScore: 0,
    totalDurationMs: 0,
    totalMerges: 0,
    maxChain: 0,
    tierReachedCounts: TIERS.map(() => 0),
    restarts: 0,
    reviveShown: 0,
    reviveAccepted: 0,
    doubleShown: 0,
    doubleAccepted: 0,
  };
}

export async function loadStats(platform: Platform): Promise<NovaStats> {
  try {
    const raw = await platform.getItem(STORAGE_KEYS.stats);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw) as Partial<NovaStats>;
    const base = emptyStats();
    return {
      ...base,
      ...parsed,
      tierReachedCounts:
        Array.isArray(parsed.tierReachedCounts) && parsed.tierReachedCounts.length === TIERS.length
          ? parsed.tierReachedCounts
          : base.tierReachedCounts,
    };
  } catch {
    return emptyStats();
  }
}

export function saveStats(platform: Platform, stats: NovaStats): void {
  void platform.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
}
