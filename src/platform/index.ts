// 런타임 감지 후 웹/TikTok 어댑터를 스왑 (docs/03 §3).

import type { Platform } from './types';
import { createWebPlatform } from './web';
import { createTikTokPlatform, isTikTokInApp } from './tiktok';

export function createPlatform(): Platform {
  return isTikTokInApp() ? createTikTokPlatform() : createWebPlatform();
}
