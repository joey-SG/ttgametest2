// TikTok Mini Game(TTMinis) 어댑터 자리 (docs/03 §3, M5에서 실제 SDK 연동 예정).
// 지금은 인앱 감지만 정확히 하고, 나머지 메서드는 안전한 no-op/false 스텁으로 둔다.

import type { Platform } from './types';

declare global {
  interface Window {
    TTMinis?: unknown;
  }
}

export function isTikTokInApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.TTMinis !== 'undefined') return true;
  // SDK가 아직 주입되지 않은 시점 대비 보조 판정 (TikTok 인앱 브라우저 UA 시그니처).
  return typeof navigator !== 'undefined' && /musical_ly|tiktok/i.test(navigator.userAgent);
}

export function createTikTokPlatform(): Platform {
  // TODO(M5): TTMinis.game SDK로 교체 — Rewarded Video Ads API, SDK 진동/스토리지 API.
  return {
    async showRewardedAd() {
      return false;
    },
    haptic() {
      // no-op — 향상 기능이므로 SDK 연동 전까지는 조용히 무시.
    },
    async setItem() {
      // no-op
    },
    async getItem() {
      return null;
    },
    async saveHighScore() {
      // no-op
    },
    async loadHighScore() {
      return 0;
    },
    isTikTokInApp() {
      return true;
    },
  };
}
