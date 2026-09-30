# 🗒️ Hybrid Sticky Memo & Todo App

바탕화면의 프레임리스 스티커 창들이 곧 전체 작업 공간이 되는 **100% 스티커 중심 크로스플랫폼(Windows & macOS) 메모 및 할 일 데스크탑 앱**입니다.  
별도 백엔드 서버를 구축하지 않고 **GitHub 비공개 Gist API**를 원격 저장소로 활용하여 Local-First로 안전하게 동기화됩니다.

---

## ✨ 핵심 특징

- **메인 보드 없는 100% 바탕화면 스티커 UX**: 모든 활성 메모와 할 일은 바탕화면 위 프레임리스 스티커 창으로만 존재하며(최대 10개), 상단바 더블클릭 시 38px 미니 바로 접어 화면 공간을 절약합니다.
- **📝 일반 메모 (`memo`) vs ☑️ 할 일 (`todo`) 완전 분리**:
  - **일반 메모**: `Tiptap` 기반 실시간 마크다운 에디터. 로그나 휴지통 없이 자유롭게 썼다 지우는 스크래치패드.
  - **할 일**: 상단 고정 입력창(`Enter`로 하단 순차 추가)을 갖춘 전용 투두 리스트. 항목별 **`[✓ 완료]`** 클릭 시 활성 목록에서 즉시 사라지며 완료 시각(`completedAt`)과 함께 **완료 아카이브 로그**에 영구 기록됩니다.
- **🗄️ 완료 아카이브 & 설정 미니 창**: 시스템 트레이 아이콘 클릭 시 400×520px 미니 창이 열리며, 완료한 할 일들을 날짜별 타임라인으로 조회·검색·복원(`[↩️ 되돌리기]`)하고 GitHub 토큰을 설정할 수 있습니다.
- **🔄 무서버 Local-First & GitHub Gist 동기화**: 모든 변경은 로컬 디스크에 0ms로 즉시 저장되며, 3초 디바운스 증분 Push 및 `ETag` 기반 Pull로 동기화됩니다. 창 좌표(`x, y`)와 접힘 상태는 기기별(`device-config.json`)로 분리 저장해 모니터 해상도 차이에 영향을 받지 않습니다.

---

## 📚 설계 및 명세 문서 (`docs/`)

전체 설계 문서는 역할별로 아래 경로에 분리되어 있습니다:

- [전체 통합 기획 및 설계서 (`implementation_plan.md`)](./implementation_plan.md)
- [1. 시스템 아키텍처 및 기술 스택 (`docs/architecture.md`)](./docs/architecture.md)
- [2. 기능정의서 (`docs/functional-spec.md`)](./docs/functional-spec.md)
- [3. 데이터 모델 및 API 명세서 (`docs/data-and-api-spec.md`)](./docs/data-and-api-spec.md)

---

## 🛠️ 기술 스택

- **Core**: Electron 34, `electron-vite`, Node.js
- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React
- **Markdown Editor**: Tiptap (`@tiptap/react`, `@tiptap/starter-kit`)
- **Packaging**: `electron-builder` (Windows `NSIS .exe` / macOS `.dmg`)
