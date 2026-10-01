import React, { useEffect, useState, useMemo } from 'react'
import {
  Archive,
  CheckCircle2,
  Cloud,
  ExternalLink,
  Laptop,
  Key,
  RefreshCw,
  Search,
  Trash2,
  Undo2,
  X,
  AlertCircle,
  Clock,
  Download,
  Upload
} from 'lucide-react'
import {
  ArchivedTodoLog,
  COLOR_THEMES,
  NoteColor,
  SyncConfigInfo,
  SyncStatus
} from '../../../shared/types'

type ActiveTab = 'archive' | 'sync'

export default function ArchiveWindow(): JSX.Element {
  const [activeTab, setActiveTab] = useState<ActiveTab>('archive')
  const [logs, setLogs] = useState<ArchivedTodoLog[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [syncConfig, setSyncConfig] = useState<SyncConfigInfo | null>(null)
  const [patInput, setPatInput] = useState('')
  const [isSavingToken, setIsSavingToken] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [autoLaunchEnabled, setAutoLaunchEnabled] = useState(false)

  // Load initial data
  useEffect(() => {
    window.api.archive.getAll().then((data) => {
      setLogs(data)
    })
    window.api.sync.getConfig().then((cfg) => {
      setSyncConfig(cfg)
    })
    window.api.system.getAutoLaunch().then((res) => {
      setAutoLaunchEnabled(res.enabled)
    })

    const handleOnline = (): void => {
      window.api.sync.triggerNow()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  // Listen for real-time notes/archive updates
  useEffect(() => {
    const unsubNotes = window.api.notes.onChanged((payload) => {
      setLogs(payload.archivedLogs)
    })
    const unsubSync = window.api.sync.onStatusChanged((payload) => {
      setSyncConfig((prev) =>
        prev
          ? {
              ...prev,
              status: payload.status,
              lastSyncedAt: payload.lastSyncedAt ?? prev.lastSyncedAt,
              message: payload.message
            }
          : null
      )
      if (payload.status !== 'SYNCING') {
        setIsSyncing(false)
      }
    })
    return () => {
      unsubNotes()
      unsubSync()
    }
  }, [])

  // Action feedback timeout
  useEffect(() => {
    if (!actionFeedback) return
    const timer = setTimeout(() => {
      setActionFeedback(null)
    }, 4000)
    return () => clearTimeout(timer)
  }, [actionFeedback])

  const handleClose = (): void => {
    window.close()
  }

  const handleUncomplete = async (logId: string): Promise<void> => {
    try {
      await window.api.archive.uncomplete({ logId })
      setActionFeedback({ type: 'success', message: '할 일이 스티커로 복원되었습니다.' })
    } catch {
      setActionFeedback({ type: 'error', message: '복원 중 오류가 발생했습니다.' })
    }
  }

  const handleDeleteLog = async (logId: string): Promise<void> => {
    try {
      await window.api.archive.deleteLog({ logId })
      setActionFeedback({ type: 'success', message: '보관 기록이 영구 삭제되었습니다.' })
    } catch {
      setActionFeedback({ type: 'error', message: '삭제 중 오류가 발생했습니다.' })
    }
  }

  const handleSaveToken = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!patInput.trim()) return
    setIsSavingToken(true)
    setActionFeedback(null)
    try {
      const res = await window.api.sync.setupToken({ token: patInput.trim() })
      if (res.success) {
        setActionFeedback({
          type: 'success',
          message: `GitHub 계정(@${res.username})과 성공적으로 연동되었습니다!`
        })
        setPatInput('')
        const updated = await window.api.sync.getConfig()
        setSyncConfig(updated)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '토큰 검증 및 연동에 실패했습니다.'
      setActionFeedback({ type: 'error', message: msg })
    } finally {
      setIsSavingToken(false)
    }
  }

  const handleTriggerSync = async (): Promise<void> => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      const res = await window.api.sync.triggerNow()
      setActionFeedback({
        type: 'success',
        message: `동기화 완료 (${res.syncedCount}개 스티커 반영됨)`
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '동기화 중 오류가 발생했습니다.'
      setActionFeedback({ type: 'error', message: msg })
    } finally {
      setIsSyncing(false)
    }
  }

  const openTokenPage = (): void => {
    window.open('https://github.com/settings/tokens/new?scopes=gist&description=StickyNotesApp', '_blank')
  }

  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const handleExportBackup = async (): Promise<void> => {
    setIsExporting(true)
    try {
      const res = await window.api.backup.exportData()
      if (res.success) {
        setActionFeedback({
          type: 'success',
          message: `백업 파일 저장 완료 (${res.count}개 항목 내보냄)`
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '백업 파일 저장 중 오류 발생'
      setActionFeedback({ type: 'error', message: msg })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportBackup = async (): Promise<void> => {
    setIsImporting(true)
    try {
      const res = await window.api.backup.importData()
      if (res.success) {
        setActionFeedback({
          type: 'success',
          message: `백업 복원 완료 (스티커 ${res.importedNotesCount}건, 완료 기록 ${res.importedLogsCount}건)`
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '백업 파일 복원 중 오류 발생'
      setActionFeedback({ type: 'error', message: msg })
    } finally {
      setIsImporting(false)
    }
  }

  const handleToggleAutoLaunch = async (): Promise<void> => {
    const next = !autoLaunchEnabled
    const res = await window.api.system.setAutoLaunch({ enabled: next })
    setAutoLaunchEnabled(res.enabled)
    setActionFeedback({
      type: 'success',
      message: res.enabled ? '부팅 시 자동 실행이 활성화되었습니다.' : '부팅 시 자동 실행이 해제되었습니다.'
    })
  }

  // Filtered & grouped logs
  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return logs
    return logs.filter(
      (l) => l.text.toLowerCase().includes(q) || l.sourceGroupTitle.toLowerCase().includes(q)
    )
  }, [logs, searchQuery])

  // Group logs by date (오늘, 어제, YYYY-MM-DD)
  const groupedLogs = useMemo(() => {
    const groups: { [key: string]: ArchivedTodoLog[] } = {}
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(yesterday.getDate()).padStart(2, '0')}`

    for (const log of filteredLogs) {
      const d = new Date(log.completedAt)
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`

      let groupTitle = dateKey
      if (dateKey === todayStr) groupTitle = '오늘'
      else if (dateKey === yesterdayStr) groupTitle = '어제'

      if (!groups[groupTitle]) {
        groups[groupTitle] = []
      }
      groups[groupTitle].push(log)
    }
    return groups
  }, [filteredLogs])

  const formatTime = (ts: number): string => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateTime = (ts?: number): string => {
    if (!ts) return '동기화 기록 없음'
    const d = new Date(ts)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
  }

  const getStatusBadge = (status: SyncStatus) => {
    switch (status) {
      case 'SYNCED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            동기화 완료
          </span>
        )
      case 'SYNCING':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">
            <RefreshCw className="h-3 w-3 text-sky-600 animate-spin" />
            동기화 중...
          </span>
        )
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">
            <AlertCircle className="h-3 w-3 text-red-600" />
            동기화 실패
          </span>
        )
      case 'OFFLINE':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
            <Clock className="h-3 w-3 text-stone-400" />
            오프라인 (로컬 전용)
          </span>
        )
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-stone-50 text-stone-900 border border-stone-300 shadow-2xl select-none">
      {/* Draggable Header */}
      <div className="app-drag-region flex h-11 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-100 text-amber-800 font-bold text-xs">
            M
          </div>
          <span className="text-xs font-bold text-stone-800">완료 아카이브 & 동기화 설정</span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="app-no-drag flex h-6 w-6 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 bg-stone-100 px-3 pt-2 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('archive')}
          className={`flex items-center gap-1.5 border-b-2 px-3 pb-2 font-medium transition-colors cursor-pointer ${
            activeTab === 'archive'
              ? 'border-amber-500 text-amber-800'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Archive className="h-3.5 w-3.5" />
          완료 보관함
          {logs.length > 0 && (
            <span className="ml-1 rounded-full bg-stone-200 px-1.5 py-0.2 text-[10px] text-stone-700">
              {logs.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sync')}
          className={`flex items-center gap-1.5 border-b-2 px-3 pb-2 font-medium transition-colors cursor-pointer ${
            activeTab === 'sync'
              ? 'border-amber-500 text-amber-800'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Cloud className="h-3.5 w-3.5" />
          동기화 & 설정
          {syncConfig?.hasToken && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          )}
        </button>
      </div>

      {/* Toast Feedback */}
      {actionFeedback && (
        <div
          className={`mx-3 mt-2 flex items-center gap-2 rounded px-3 py-1.5 text-xs animate-in fade-in duration-150 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {actionFeedback.type === 'success' ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
          )}
          <span className="truncate">{actionFeedback.message}</span>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="flex-1 overflow-hidden p-3">
        {activeTab === 'archive' ? (
          <div className="flex h-full flex-col">
            {/* Search Bar */}
            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="완료된 할 일 또는 그룹명 검색..."
                className="w-full rounded-md border border-stone-300 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Logs List */}
            <div className="flex-1 overflow-y-auto pr-1">
              {filteredLogs.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-stone-400">
                  <Archive className="mb-2 h-9 w-9 text-stone-300" />
                  <p className="text-xs">
                    {searchQuery ? '검색 결과가 없습니다.' : '완료된 항목이 없습니다.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 pb-2">
                  {Object.entries(groupedLogs).map(([dateLabel, items]) => (
                    <div key={dateLabel}>
                      <div className="sticky top-0 z-10 mb-1.5 flex items-center gap-1.5 bg-stone-50 py-1 text-[11px] font-bold text-stone-500">
                        <Clock className="h-3 w-3" />
                        <span>{dateLabel}</span>
                        <span className="text-stone-400">({items.length})</span>
                      </div>
                      <div className="space-y-1">
                        {items.map((log) => {
                          const theme = COLOR_THEMES[log.color as NoteColor] || COLOR_THEMES.yellow
                          return (
                            <div
                              key={log.id}
                              className="group flex items-center justify-between rounded-lg border border-stone-200/80 bg-white p-2 text-xs shadow-xs hover:border-amber-200 hover:bg-amber-50/20 transition-colors"
                            >
                              <div className="flex min-w-0 flex-1 items-start gap-2">
                                <span
                                  style={{ backgroundColor: theme.dot }}
                                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                                  title={`그룹 색상: ${theme.label}`}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-stone-800 line-through decoration-stone-300">
                                    {log.text}
                                  </p>
                                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-stone-400">
                                    <span className="truncate text-stone-500 font-medium">
                                      {log.sourceGroupTitle || '할 일'}
                                    </span>
                                    <span>•</span>
                                    <span>{formatTime(log.completedAt)}</span>
                                    {log.completedByDevice && (
                                      <>
                                        <span>•</span>
                                        <span className="truncate">{log.completedByDevice}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => handleUncomplete(log.id)}
                                  title="할 일 스티커로 되돌리기"
                                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-amber-100 text-stone-600 hover:text-amber-800 transition-colors cursor-pointer"
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLog(log.id)}
                                  title="기록 영구 삭제"
                                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-red-100 text-stone-400 hover:text-red-700 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col overflow-y-auto space-y-3 pr-1 text-xs">
            {/* Sync Status Card */}
            <div className="rounded-lg border border-stone-200 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-stone-800">동기화 상태</span>
                {syncConfig && getStatusBadge(syncConfig.status)}
              </div>

              <div className="space-y-1.5 text-[11px] text-stone-600">
                <div className="flex items-center justify-between">
                  <span className="text-stone-400">최근 동기화:</span>
                  <span className="font-mono">{formatDateTime(syncConfig?.lastSyncedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-400">현재 디바이스:</span>
                  <span className="font-semibold text-stone-700 flex items-center gap-1">
                    <Laptop className="h-3 w-3 text-stone-500" />
                    {syncConfig?.deviceName}
                  </span>
                </div>
                {syncConfig?.gistId && (
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">저장소 Gist:</span>
                    <a
                      href={`https://gist.github.com/${syncConfig.gistId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-amber-700 hover:underline flex items-center gap-0.5"
                    >
                      {syncConfig.gistId.slice(0, 10)}...
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                )}
              </div>

              {syncConfig?.hasToken && (
                <div className="mt-3 pt-2.5 border-t border-stone-100 flex justify-end">
                  <button
                    type="button"
                    onClick={handleTriggerSync}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    지금 바로 동기화
                  </button>
                </div>
              )}
            </div>

            {/* GitHub PAT Settings Card */}
            <div className="rounded-lg border border-stone-200 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-stone-800 flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-amber-700" />
                  GitHub Gist 연동
                </span>
                {syncConfig?.hasToken ? (
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                    연결됨
                  </span>
                ) : (
                  <span className="text-[10px] text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
                    미연동
                  </span>
                )}
              </div>

              <p className="text-[11px] text-stone-500 mb-3 leading-relaxed">
                GitHub Personal Access Token을 등록하면 별도의 서버 없이 본인의 비밀 Gist 저장소를 통해 Windows와 Mac 간에 실시간 동기화됩니다.
              </p>

              <form onSubmit={handleSaveToken} className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-stone-700">
                    GitHub PAT (Personal Access Token)
                  </label>
                  <input
                    type="password"
                    value={patInput}
                    onChange={(e) => setPatInput(e.target.value)}
                    placeholder={
                      syncConfig?.hasToken
                        ? '토큰을 갱신하려면 새 토큰을 입력하세요'
                        : 'ghp_ 또는 github_pat_...'
                    }
                    className="w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-xs font-mono outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={openTokenPage}
                    className="text-[11px] text-stone-500 hover:text-stone-800 underline flex items-center gap-0.5 cursor-pointer"
                  >
                    토큰 발급 방법 안내 (gist 권한 필요)
                    <ExternalLink className="h-2.5 w-2.5" />
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingToken || !patInput.trim()}
                    className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isSavingToken ? '확인 중...' : syncConfig?.hasToken ? '토큰 변경' : '연동 시작'}
                  </button>
                </div>
              </form>
            </div>

            {/* Backup & Restore Card */}
            <div className="rounded-lg border border-stone-200 bg-white p-3.5 shadow-xs">
              <span className="font-bold text-stone-800 flex items-center gap-1.5 mb-1.5">
                <Download className="h-3.5 w-3.5 text-stone-600" />
                로컬 데이터 백업 및 복원
              </span>
              <p className="text-[11px] text-stone-500 mb-3 leading-relaxed">
                현재 활성화된 모든 스티커와 완료 기록을 하나의 JSON 파일로 안전하게 백업하거나 불러옵니다.
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-stone-300 bg-stone-50 hover:bg-stone-100 px-2.5 py-1.5 text-xs font-medium text-stone-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-stone-500" />
                  {isExporting ? '저장 중...' : '백업 파일 내보내기'}
                </button>

                <button
                  type="button"
                  onClick={handleImportBackup}
                  disabled={isImporting}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-stone-300 bg-stone-50 hover:bg-stone-100 px-2.5 py-1.5 text-xs font-medium text-stone-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 text-stone-500" />
                  {isImporting ? '불러오는 중...' : '백업 파일 불러오기'}
                </button>
              </div>
            </div>

            {/* System Preferences Card */}
            <div className="rounded-lg border border-stone-200 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-stone-800 text-xs">Windows 시작 시 자동 실행</span>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    컴퓨터 부팅 시 바탕화면에 스티커 메모를 자동으로 띄웁니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAutoLaunch}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoLaunchEnabled ? 'bg-amber-500' : 'bg-stone-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      autoLaunchEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Features Guide Card */}
            <div className="rounded-lg border border-stone-200 bg-stone-100/60 p-3 text-[11px] text-stone-600 space-y-1 leading-relaxed">
              <p className="font-semibold text-stone-700">💡 단축키 및 사용 팁</p>
              <ul className="list-disc list-inside space-y-0.5 text-stone-500">
                <li><kbd className="rounded bg-white px-1 py-0.5 border border-stone-300 text-[10px]">Ctrl+Shift+N</kbd>: 새 메모 스티커 생성</li>
                <li><kbd className="rounded bg-white px-1 py-0.5 border border-stone-300 text-[10px]">Ctrl+Shift+T</kbd>: 새 할 일 스티커 생성</li>
                <li>스티커 상단 헤더 더블클릭: 38px 얇은 바로 접기/펴기</li>
                <li>트레이 아이콘 좌클릭: 완료 아카이브 & 설정 열기</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
