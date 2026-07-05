import { STORAGE_KEYS } from '../config';
import type { HapticKind, Platform } from './types';

// 웹 폴백 어댑터. 저장은 localStorage(프라이빗 모드 대비 try/catch), 햅틱은 뼈대만.
// 보상형 광고 카운트다운 오버레이는 M3에서 구현 — 지금은 완주 실패(false) 스텁.

function vibratePattern(kind: HapticKind): number | number[] {
  switch (kind) {
    case 'select':
      return 10;
    case 'success':
      return 20;
    case 'combo':
      return [20, 30, 20];
    case 'fail':
      return 40;
  }
}

export function createWebPlatform(): Platform {
  return {
    async showRewardedAd(_placement) {
      // M3: 3초 카운트다운 오버레이 + TikTok SDK 연동. M1은 항상 미완주 처리.
      return false;
    },

    haptic(kind) {
      try {
        // Android/일부 브라우저: Vibration API.
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(vibratePattern(kind));
          return;
        }
        // iOS Safari는 Vibration API 미지원. checkbox+label.click() 토글 트릭
        // (docs/03 §3.2, stopPropagation 필수)은 juice 패스(M2)에서 DOM 요소와 함께 구현한다.
        // 그때까지는 조용히 no-op — 햅틱은 향상이지 필수 의존이 아니다.
      } catch {
        // 향상 기능이므로 실패는 무시한다.
      }
    },

    async setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // 프라이빗 모드 등에서 저장 실패는 무해하게 무시.
      }
    },

    async getItem(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },

    async saveHighScore(score) {
      try {
        localStorage.setItem(STORAGE_KEYS.highScore, String(score));
      } catch {
        // 무시
      }
    },

    async loadHighScore() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.highScore);
        const parsed = raw ? Number(raw) : 0;
        return Number.isFinite(parsed) ? parsed : 0;
      } catch {
        return 0;
      }
    },

    isTikTokInApp() {
      return false;
    },
  };
}
