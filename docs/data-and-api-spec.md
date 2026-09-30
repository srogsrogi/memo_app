# 📡 데이터 모델 및 API 명세서 (Data Schema & API Spec)

## 1. 데이터 모델 정의서 (Data Schema)

### 1.1 원격 동기화 모델 (GitHub Gist 저장 규격)

#### ① 개별 활성 스티커 파일 (`note-{uuid}.json`)
```typescript
export type NoteType = 'memo' | 'todo';
export type NoteColor = 'yellow' | 'mint' | 'pink' | 'purple';

export interface TodoItem {
  id: string;               // 항목 고유 UUID v4
  text: string;             // 할 일 내용
  createdAt: number;        // 항목 등록 시각 (Epoch ms)
}

export interface Note {
  id: string;               // 스티커 고유 UUID v4
  type: NoteType;           // 'memo' | 'todo'
  color: NoteColor;         // 4종 테마 컬러 ('yellow' | 'mint' | 'pink' | 'purple')

  // type === 'memo' 일 때 사용 (type === 'todo'이면 빈 문자열 "")
  content: string;          // 마크다운 원문 텍스트

  // type === 'todo' 일 때 사용 (type === 'memo'이면 빈 문자열 및 빈 배열)
  groupTitle: string;       // 할 일 그룹 제목 (예: "오늘 할 일")
  todos: TodoItem[];        // 현재 진행 중인 미완료 항목 목록

  createdAt: number;        // 최초 생성 시각 (Epoch ms)
  updatedAt: number;        // 최종 수정 시각 (Epoch ms)
  lastDeviceName: string;   // 최종 수정한 기기 이름 (예: "Home-PC", "MacBook-Pro")
}
```

#### ② 완료 아카이브 & 동기화 메타 파일 (`todo-archive.json`)
```typescript
export interface ArchivedTodoLog {
  id: string;               // TodoItem.id
  text: string;             // 할 일 내용
  sourceNoteId: string;     // 완료 당시 속해 있던 스티커 ID
  sourceGroupTitle: string; // 완료 당시 그룹 제목 (예: "업무")
  color: NoteColor;         // 완료 당시 스티커 배경색
  createdAt: number;        // 할 일 등록 시각 (Epoch ms)
  completedAt: number;      // 완료 클릭 시각 (Epoch ms — 타임라인 정렬 기준)
  completedByDevice: string;// 완료 처리한 기기 이름
}

export interface GistArchivePayload {
  archivedLogs: ArchivedTodoLog[];
  deletedNoteIds: Record<string, number>; // { [noteId]: deletedAtMs } 기기 간 스티커 삭제 전파용
  deletedLogIds: Record<string, number>;  // { [logId]: deletedAtMs } 아카이브 영구삭제 전파용
}
```

---

### 1.2 기기 전용 로컬 설정 모델 (`device-config.json`)
모니터 해상도 차이로 인해 창이 화면 밖으로 벗어나는 문제를 예방하기 위해 로컬에만 저장됩니다.

```typescript
export interface StickyWindowState {
  x: number;
  y: number;
  width: number;            // 기본값: 300
  height: number;           // 기본값: 360
  alwaysOnTop: boolean;     // 기본값: false
  isCollapsed: boolean;     // 기본값: false (높이 38px 미니바 여부)
}

export interface NoteSyncMeta {
  baseUpdatedAt: number;    // 마지막 Gist 동기화 시점의 updatedAt (동시 수정 충돌 감지)
  isDirty: boolean;         // 로컬 수정 후 Gist 미반영 여부
}

export type SyncStatus = 'SYNCED' | 'SYNCING' | 'OFFLINE' | 'ERROR';

export interface LocalDeviceConfig {
  deviceId: string;
  deviceName: string;       // 기본값: os.hostname()
  encryptedGithubToken?: string; // Electron safeStorage 암호화 문자열
  gistId?: string;
  lastSyncedAt?: number;
  lastEtag?: string;
  stickies: Record<string, StickyWindowState>; // Key: Note.id
  syncMeta: Record<string, NoteSyncMeta>;      // Key: Note.id
  isArchiveDirty: boolean;
}
```

---

## 2. 내부 IPC API 명세서 (Renderer ↔ Main Process)

프론트엔드에서는 Preload 브릿지를 통해 `window.api.*` 메서드로 호출합니다.

```typescript
export interface StickyViewModel extends Note {
  alwaysOnTop: boolean;
  isCollapsed: boolean;
}
```

### 2.1 스티커 데이터 관리 API
| 채널명 (Endpoint) | 통신 방식 | Request Payload | Response | 상세 동작 규격 |
| :--- | :---: | :--- | :--- | :--- |
| `notes:getAllStickies` | Invoke | `void` | `StickyViewModel[]` | 로컬 전체 활성 스티커 목록 + 창 상태 반환 |
| `notes:getById` | Invoke | `{ id: string }` | `StickyViewModel \| null` | 스티커 창 최초 로드 시 해당 데이터 조회 |
| `notes:create` | Invoke | `{ type: 'memo' \| 'todo', color?: NoteColor }` | `StickyViewModel` | 새 스티커 생성 후 프레임리스 창 즉시 오픈 (최대 10개 제한 검증) |
| `notes:updateMemo` | Invoke | `{ id: string, content?: string, color?: NoteColor }` | `StickyViewModel` | 일반 메모 본문/색상 수정 및 3초 디바운스 Push 예약 |
| `notes:updateTodoGroup`| Invoke | `{ id: string, groupTitle?: string, color?: NoteColor }`| `StickyViewModel` | 할 일 그룹명/색상 수정 |
| `notes:addTodoItem` | Invoke | `{ noteId: string, text: string }` | `StickyViewModel` | 상단 입력창에서 `Enter` 시 리스트 맨 아래에 추가 |
| `notes:editTodoItem` | Invoke | `{ noteId: string, itemId: string, text: string }` | `StickyViewModel` | 특정 항목 텍스트 인라인 수정 |
| `notes:completeTodoItem`| Invoke | `{ noteId: string, itemId: string }` | `{ note: StickyViewModel, archivedLog: ArchivedTodoLog }` | 항목을 활성 카드에서 제거하고 아카이브에 즉시 추가 후 브로드캐스트 |
| `notes:deleteTodoItem` | Invoke | `{ noteId: string, itemId: string }` | `StickyViewModel` | 항목 단순 제거 (아카이브에 기록하지 않음) |
| `notes:deleteSticky` | Invoke | `{ id: string }` | `{ success: boolean }` | 스티커 창 닫기 및 파일 영구 삭제, Gist 삭제 예약 |
| **`notes:changed`** | **Broadcast** | `{ stickies: StickyViewModel[], archivedLogs: ArchivedTodoLog[] }` | *(단방향)* | 스티커 수정 또는 Pull 완료 시 모든 열린 창 동기화 |

### 2.2 완료 아카이브 API
| 채널명 (Endpoint) | 통신 방식 | Request Payload | Response | 상세 동작 규격 |
| :--- | :---: | :--- | :--- | :--- |
| `archive:getAll` | Invoke | `void` | `ArchivedTodoLog[]` | 완료 시각(`completedAt`) 역순 정렬된 전체 로그 반환 |
| `archive:uncomplete` | Invoke | `{ logId: string }` | `{ stickies: StickyViewModel[], archivedLogs: ArchivedTodoLog[] }` | 아카이브에서 제거하고 원래 스티커(삭제되었으면 새 스티커 생성)로 복구 |
| `archive:deleteLog` | Invoke | `{ logId: string }` | `{ success: boolean }` | 특정 완료 기록 영구 삭제 |

### 2.3 창 제어 & 동기화 설정 API
| 채널명 (Endpoint) | 통신 방식 | Request Payload | Response | 상세 동작 규격 |
| :--- | :---: | :--- | :--- | :--- |
| `window:openArchive` | Invoke | `void` | `{ success: boolean }` | '완료 아카이브 & 설정' 미니 창 오픈 또는 포커스 |
| `window:toggleAlwaysOnTop` | Invoke | `{ noteId: string }` | `{ alwaysOnTop: boolean }` | 해당 창 Always-on-Top 토글 및 로컬 저장 |
| `window:toggleCollapse` | Invoke | `{ noteId: string }` | `{ isCollapsed: boolean }` | 상단바 더블클릭 시 38px 미니바 토글 |
| `window:toggleHideAll` | Invoke | `void` | `{ isHidden: boolean }` | 트레이 메뉴용: 모든 스티커 일시 숨김/보이기 토글 |
| `sync:getConfig` | Invoke | `void` | `{ hasToken: boolean, gistId?: string, deviceName: string, lastSyncedAt?: number, status: SyncStatus }` | 현재 동기화 설정 및 상태 조회 |
| `sync:setupToken` | Invoke | `{ token: string }` | `{ success: boolean, gistId: string, username: string }` | PAT 검증, Gist 자동 탐색/생성 및 초기 동기화 |
| `sync:triggerNow` | Invoke | `void` | `{ status: SyncStatus, syncedCount: number }` | 즉시 수동 동기화 실행 |
| **`sync:statusChanged`** | **Broadcast** | `{ status: SyncStatus, lastSyncedAt?: number, message?: string }` | *(단방향)* | 동기화 상태 갱신 이벤트 |

---

## 3. 외부 REST API 명세서 (Main Process ↔ GitHub Gist API)

- **Base URL**: `https://api.github.com`
- **공통 Request Headers**:
  - `Authorization: Bearer <GITHUB_PAT_TOKEN>` (필수 스코프: `gist`)
  - `Accept: application/vnd.github+json`
  - `X-GitHub-Api-Version: 2022-11-28`

| 순서 | 연동 목적 | HTTP Method & URI | Request / Response 핵심 규격 | 에러 및 캐시 처리 |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **토큰 검증** | `GET /user` | **Res `200`**: `{ "login": "username" }` | `401 Unauthorized` 시 토큰 오류 반환 |
| **2** | **기존 Gist 탐색** | `GET /gists?per_page=100` | **Res `200`**: `description === "[HybridMemoApp] Sync Store"`인 비공개 Gist 검색 | 일치하는 Gist 발견 시 해당 `id`를 `gistId`에 저장 |
| **3** | **신규 Gist 생성** | `POST /gists` | **Req**: `{ "description": "[HybridMemoApp] Sync Store", "public": false, "files": { "todo-archive.json": { "content": "{...}" } } }`<br/>**Res `201`**: `{ "id": "gist_id" }` | 기존 Gist가 없을 때 최초 1회만 호출 |
| **4** | **변경분 Pull** | `GET /gists/{gist_id}` | **Req Header**: `If-None-Match: "<lastEtag>"`<br/>**Res `304`**: 변경 없음<br/>**Res `200`**: `{ "files": { "note-{id}.json": { "content": "{...}" }, "todo-archive.json": { "content": "{...}" } } }` | `304` 응답 시 API Rate Limit이 차감되지 않으며 즉시 종료 |
| **5** | **변경분 증분 Push** | `PATCH /gists/{gist_id}` | **Req**: `{ "files": { "note-{id}.json": { "content": "{...}" }, "note-{deletedId}.json": null, "todo-archive.json": { "content": "{...}" } } }` | `isDirty === true`인 파일만 전송하며, 영구 삭제된 스티커는 파일값 `null`을 전송해 원격 파일 삭제 |
