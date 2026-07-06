# NOVA 🌌 — 우주 머지-드롭 퍼즐 아케이드

TikTok에서 바이럴 가능한 **피직스 머지-드롭 게임**. 드래그로 조준해 천체를 떨어뜨리고,
같은 천체끼리 닿으면 합쳐져 더 큰 천체가 된다 — **별먼지에서 블랙홀까지**.
넘치면 게임오버, 광고를 보면 부활해 이어간다.

두 번째 실험 프로젝트: **기획(시장조사·게임 선정·문서)은 Claude Fable 5**,
**코딩·검증·배포는 Claude Sonnet 5**가 담당하는 모델 라우팅 구성.
(#1 프로젝트: [ttgametest / PULSE](https://github.com/joey-SG/ttgametest1) — 원탭 리듬 아케이드)

## 플레이

- 웹 데모: **https://nova-merge-drop.netlify.app** (iPhone Safari에서 직접 열기 권장 — 햅틱·사운드)
- 조작: **드래그로 좌우 조준, 손을 떼면 드롭.** 같은 천체끼리 닿으면 합체.
- 연쇄 머지(체인)로 점수 배율 ×2/×3/×4. 상단 라인을 넘치면 게임오버.

## 문서 지도

| 문서 | 내용 |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Karpathy 4원칙 기반 개발 규칙 + 검증 게이트 |
| [`docs/01-market-research.md`](./docs/01-market-research.md) | 2026-07 시장조사·장르 선정·타겟 |
| [`docs/02-game-design.md`](./docs/02-game-design.md) | NOVA 컨셉·11티어 사다리·체인 배율·수익화 |
| [`docs/03-tech-architecture.md`](./docs/03-tech-architecture.md) | 자체 원형 물리 스펙·플랫폼 어댑터·iPhone 햅틱 |
| [`docs/04-deployment.md`](./docs/04-deployment.md) | 웹 데모 + TikTok Mini Game 배포 |
| [`docs/05-handoff.md`](./docs/05-handoff.md) | 구현 에이전트(Sonnet 5) 핸드오프 |
| [`docs/06-benchmark-and-direction.md`](./docs/06-benchmark-and-direction.md) | 벤치마크 맵·의사결정 로그 |

## 개발

```bash
npm install
npm run dev      # 로컬 개발
npm run build    # tsc + vite build → dist/
```

## 방법론

- **CLAUDE.md**: [Andrej Karpathy의 4원칙](https://github.com/multica-ai/andrej-karpathy-skills)을 프로젝트 성공 기준으로 재작성.
- **SPEC-First**: 코딩 전 시장조사 → 게임 선정 → 스펙 문서 확정 ([moai-adk](https://github.com/modu-ai/moai-adk) 관점).
- **벤치마크 조합**: 검증된 조각만 조합 (Suika 코어 + Beatstar 배율 철학 + Subway Surfers 부활 원칙).
