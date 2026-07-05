// 플랫폼 어댑터 인터페이스 (docs/03 §3). 게임 로직은 이 인터페이스만 참조하고
// SDK/브라우저 API를 직접 호출하지 않는다.

export type HapticKind = 'success' | 'fail' | 'combo' | 'select';
export type AdPlacement = 'revive' | 'double';

export interface Platform {
  /** 완주 시 true를 resolve. M1에서는 스텁(항상 false) — 실제 광고 플로우는 M3. */
  showRewardedAd(placement: AdPlacement): Promise<boolean>;
  haptic(kind: HapticKind): void;
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  saveHighScore(score: number): Promise<void>;
  loadHighScore(): Promise<number>;
  isTikTokInApp(): boolean;
}
