# 04 · 배포 (Deployment)

"배포까지 가능하게"가 목표. 두 트랙:
**(A) 웹 데모** — 즉시 플레이 링크로 검증·공유. **(B) TikTok Mini Game** — 실제 제출 준비.

---

## A. 웹 데모 배포

### 절차
1. `npm run build` → `dist/` 정적 산출물. (성공 기준: 빌드 성공 + `dist` < 50MB)
2. GitHub 푸시: `https://github.com/joey-SG/ttgametest2` (main).
3. 정적 호스팅 배포:
   - **1순위 Netlify** (`netlify.toml` 준비됨, 세션에 MCP 커넥터 연결).
   - **폴백 Vercel** (MCP `deploy_to_vercel`).
4. 배포 URL을 브라우저에서 열어 검증: 로딩 → 첫 입력 반응 → 코어 루프 1회 완주 → `console.error` 0.
5. **iPhone Safari 실기 확인은 사용자 몫** (아래 체크리스트 전달).

### iPhone 실기 체크리스트 (사용자 확인 항목)
- [ ] iPhone Safari에서 정상 로드 & 60fps 체감 (천체 30개 이상 쌓인 상태 포함).
- [ ] 드래그 조준이 부드럽고, 스크롤/줌이 끼어들지 않는가.
- [ ] 머지/체인/경고에서 햅틱이 울리는가 (iOS 26.5+는 안 울릴 수 있음 → 무해 폴백 확인).
- [ ] 세로 화면, 노치/세이프에어리어 대응.
- [ ] 게임오버 → 광고 폴백(카운트다운) → 부활 → 이어하기 흐름이 끊김 없는가.
- [ ] 소리가 첫 탭 이후 정상 재생되는가 (음소거 스위치 상태도 확인).

## B. TikTok Mini Game 제출 (준비까지 — 개발자 계정은 사용자 액션)

1. HTML5 산출물 < 50MB 확인.
2. `src/platform/tiktok.ts`의 `TTMinis.game` SDK 래핑이 인앱에서 로드되는지 확인.
3. Rewarded Video Ads 콜백(boolean)으로만 보상 지급되는지 확인.
4. developers.tiktok.com 계정·앱 등록 → 패키지 업로드 → 인앱 프리뷰 → 심사 제출.

### 제출 전 게이트
- [ ] 패키지 < 50MB. [ ] 인앱에서 광고·햅틱·저장 SDK 경로 동작.
- [ ] `isTikTokInApp()` 감지로 웹 폴백 → SDK 스왑 확인. [ ] 정상 경로 `console.error` 0.

## C. 배포 운영 규칙

- `main` push = 배포 가능한 상태 유지 (마일스톤 커밋마다 빌드 게이트 통과 필수).
- 배포 URL은 README에 기재하고, 변경 시 갱신.
