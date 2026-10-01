# 🗒️ Hybrid Sticky Memo & Todo App

바탕화면의 프레임리스 스티커 창들이 곧 전체 작업 공간이 되는 **100% 스티커 중심 크로스플랫폼(Windows & macOS) 메모 및 할 일 데스크탑 앱**입니다.  
별도 백엔드 서버를 구축하지 않고 **GitHub 비공개 Gist API**를 원격 저장소로 활용하여 Local-First로 안전하게 동기화됩니다.

---

## ✨ 핵심 특징

- **메인 보드 없는 100% 바탕화면 스티커 UX**: 모든 활성 메모와 할 일은 바탕화면 위 프레임리스 스티커 창으로만 존재하며(최대 10개, ±14px 자석 스냅 결합), 상단바 더블클릭 시 38px 미니 바로 접어 화면 공간을 절약합니다.
- **📝 일반 메모 (`memo`) vs ☑️ 할 일 (`todo`) 완전 분리**:
  - **일반 메모**: `Tiptap` 기반 실시간 마크다운 에디터. 로그나 휴지통 없이 자유롭게 썼다 지우는 스크래치패드 (삭제 시 3초 인라인 실행 취소 지원).
  - **할 일**: 상단 고정 입력창(`Enter`로 하단 순차 추가)을 갖춘 전용 투두 리스트.
    - **`[✓ 완료]`**: 활성 목록에서 즉시 사라지며 완료 시각(`completedAt`)과 함께 **완료 아카이브 로그**에 영구 기록 (3초 실행 취소 토스트 지원).
    - **`[📅 만료일 설정]`**: 달력 클릭 선택 및 텍스트 직접 입력(`2026-10-15`, `10/15`, `오늘`, `내일`)을 모두 지원하며, 기한 초과 시 붉은색 경고 배지로 자동 강조.
    - **`[▲/▼ 순서 재배치]`**: 항목별 위/아래 순서 즉시 이동 지원.
- **🗄️ 완료 아카이브 & 설정 창 (420×540px, 3개 탭)**:
  - **📑 활성 스티커**: 전체 열린 스티커 내용/투두 실시간 검색 및 1클릭 화면 즉시 포커스 네비게이터, 빠른 새 스티커 생성.
  - **🗄️ 완료 보관함**: 완료한 할 일들을 날짜별 타임라인으로 조회·검색·복원(`[↩️ 되돌리기]`, 원래 마감일 보존).
  - **☁️ 동기화 & 설정**: GitHub PAT 토큰 등록, `[🔄 지금 동기화]`, 로컬 단일 JSON 내보내기/불러오기(오프라인 백업 및 복원), 부팅/로그인 시 자동 실행 설정.
- **🔄 무서버 Local-First & GitHub Gist 동기화**: 모든 변경은 로컬 디스크에 0ms로 즉시 저장되며, 3초 디바운스 증분 Push 및 `ETag` 기반 Pull로 동기화됩니다. 창 좌표(`x, y`)와 접힘 상태는 기기별(`device-config.json`)로 분리 저장해 모니터 해상도 차이에 영향을 받지 않습니다.
- **💻 크로스플랫폼 OS 맞춤 지원**:
  - **macOS**: 상단 메뉴바 포스트잇 아이콘 상주, 하단 독(Dock) 클릭 시 메인 창 자동 오픈, `Cmd+Shift+N/T` 단축키, `macOS 로그인 시 자동 실행` 지원.
  - **Windows**: 작업표시줄 시스템 트레이 상주, `Ctrl+Shift+N/T` 단축키, `Windows 시작 시 자동 실행` 지원.

---

## 📚 설계 및 명세 문서 (`docs/`)

전체 설계 문서는 역할별로 아래 경로에 상세히 정의되어 있습니다:

- [1. 시스템 아키텍처 및 기술 스택 (`docs/architecture.md`)](./docs/architecture.md)
- [2. 기능정의서 (`docs/functional-spec.md`)](./docs/functional-spec.md)
- [3. 데이터 모델 및 API 명세서 (`docs/data-and-api-spec.md`)](./docs/data-and-api-spec.md)

---

## 🛠️ 기술 스택

- **Core**: Electron 34, `electron-vite`, Node.js
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React
- **Markdown Editor**: Tiptap (`@tiptap/react`, `@tiptap/starter-kit`)
- **Packaging**: `electron-builder` (Windows `NSIS .exe` / macOS `.dmg`)

---

## 📌 향후 과제 (Roadmap TODO)

- [ ] **GitHub Releases 연동 인앱 자동 업데이트 (`electron-updater`)**:
  - 태그 푸시 시 GitHub Actions 크로스플랫폼 빌드 자동화
  - 앱 실행 시 신규 버전 백그라운드 체크 및 원클릭 재시작 업데이트 지원

