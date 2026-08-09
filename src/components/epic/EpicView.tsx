import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  RefreshCw, Loader2, AlertCircle, X, CloudDownload, ChevronDown,
  AlertTriangle, ArrowUp, ArrowDown, Maximize2, Minimize2, SlidersHorizontal,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { epicDb, syncEpicsFromAdo, calcEpicTestDate } from '../../lib/epicDb'
import TesterGanttView from '../planning/TesterGanttView'
import type { Epic, AzureDevOpsConfig } from '../../types/epic'
import type { PlanningProject } from '../../types/planning'
import type { Employee } from '../../types'
import { ADO_CONFIG_KEY } from '../../types/epic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function epicToProject(e: Epic): PlanningProject {
  return {
    id: e.id, iteration: e.iteration, projectName: e.feature,
    itemType: e.itemType, feature: e.project, tags: '',
    status: e.state, testLead: e.testLead, priority: '',
    tester: e.testOwner, goLiveDate: e.targetDate, uatDate: e.uatDate,
    testingPercent: e.testingPercent, testerFlag: e.testerFlag,
    testerNote: e.testerNote, testEstimateDay: e.testEstimateDay,
    testDate: e.testDate, remarkToPmos: '', pm: '', baNote: '',
    quotationNo: String(e.epicNo), epicNo: String(e.epicNo),
    createdAt: e.createdAt, updatedAt: e.updatedAt,
  }
}

function isDeployedEpic(e: Epic): boolean {
  return e.testerFlag.some(f => f.toLowerCase() === 'deployed')
}
function isDelayPlan(e: Epic, todayIso: string): boolean {
  if (isDeployedEpic(e)) return false
  const ref = e.targetDate ?? e.uatDate
  return !!ref && ref < todayIso
}

// ─── Portal dropdown ──────────────────────────────────────────────────────────

function PortalSelect({ value, options, placeholder, onChange, minWidth = 200 }: {
  value: string; options: readonly string[]; placeholder?: string
  onChange: (v: string) => void; minWidth?: number
}) {
  const [open, setOpen]   = useState(false)
  const [pos, setPos]     = useState({ top: 0, left: 0, width: minWidth })
  const trigRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const openMenu = useCallback(() => {
    if (!trigRef.current) return
    const r = trigRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, minWidth) })
    setOpen(true)
  }, [minWidth])

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      const t = e.target as Node
      if (!trigRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <>
      <button ref={trigRef} type="button"
        onClick={() => open ? setOpen(false) : openMenu()}
        className="flex items-center justify-between gap-1 text-left w-full cursor-pointer rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-600 text-xs text-gray-800 dark:text-slate-100"
      >
        <span className={`flex-1 truncate ${!value ? 'text-gray-400 dark:text-slate-500 italic' : ''}`}>
          {value || placeholder || '—'}
        </span>
        <ChevronDown size={10} className="shrink-0 text-gray-400" />
      </button>
      {open && createPortal(
        <div ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999 }}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-xl max-h-72 overflow-y-auto">
          {placeholder && (
            <div onMouseDown={() => { onChange(''); setOpen(false) }}
              className="px-3 py-1.5 text-xs text-gray-400 italic cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
              {placeholder}
            </div>
          )}
          {options.map(opt => (
            <div key={opt} onMouseDown={() => { onChange(opt); setOpen(false) }}
              className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 ${
                opt === value ? 'font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/20' : 'text-gray-700 dark:text-slate-200'
              }`}>{opt}</div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

// ─── TesterFlagCell ───────────────────────────────────────────────────────────

function TesterFlagCell({ selected, masterFlags, onChange }: {
  selected: string[]; masterFlags: string[]; onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0, width: 200 })
  const trigRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const openMenu = useCallback(() => {
    if (!trigRef.current) return
    const r = trigRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 200) })
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      const t = e.target as Node
      if (!trigRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={trigRef} className="relative">
      <div onClick={() => open ? setOpen(false) : openMenu()}
        className="cursor-pointer flex items-start gap-1 rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-600 min-w-[120px]">
        <div className="flex flex-wrap gap-0.5 flex-1 max-w-[180px]">
          {selected.length === 0
            ? <span className="text-gray-400 italic text-[11px]">—</span>
            : selected.map(f => <span key={f} className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-[10px]">{f}</span>)
          }
        </div>
        <ChevronDown size={10} className="text-gray-400 shrink-0 mt-0.5" />
      </div>
      {open && createPortal(
        <div ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999 }}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {masterFlags.map(flag => (
            <label key={flag} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer">
              <input type="checkbox" checked={selected.includes(flag)}
                onChange={() => onChange(selected.includes(flag) ? selected.filter(f => f !== flag) : [...selected, flag])}
                className="w-3 h-3 accent-indigo-600" />
              <span className="text-xs text-gray-700 dark:text-slate-200">{flag}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <div className="border-t border-gray-100 dark:border-slate-700 px-3 py-1.5">
              <button onMouseDown={() => { onChange([]); setOpen(false) }} className="text-[11px] text-red-500 hover:underline">Clear all</button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ─── Azure DevOps Config Modal ────────────────────────────────────────────────

function AdoConfigModal({ onSync, onClose }: {
  onSync: (cfg: AzureDevOpsConfig) => void
  onClose: () => void
}) {
  const saved: AzureDevOpsConfig = (() => {
    try { return JSON.parse(localStorage.getItem(ADO_CONFIG_KEY) ?? '{}') } catch { return {} }
  })()
  const [orgUrl,   setOrgUrl]   = useState(saved.orgUrl   ?? '')
  const [project,  setProject]  = useState(saved.project  ?? '')
  const [pat,      setPat]      = useState(saved.pat       ?? '')
  const [syncing,  setSyncing]  = useState(false)
  const [result,   setResult]   = useState<string | null>(null)
  const [err,      setErr]      = useState<string | null>(null)

  async function handleSync() {
    if (!orgUrl.trim() || !project.trim() || !pat.trim()) {
      setErr('กรุณากรอกข้อมูลให้ครบ'); return
    }
    const cfg: AzureDevOpsConfig = { orgUrl: orgUrl.trim(), project: project.trim(), pat: pat.trim() }
    localStorage.setItem(ADO_CONFIG_KEY, JSON.stringify(cfg))
    setSyncing(true); setErr(null); setResult(null)
    try {
      onSync(cfg)
    } catch (e: any) {
      setErr(e.message ?? 'Sync ล้มเหลว')
      setSyncing(false)
    }
  }

  const ic = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400'
  const lc = 'block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CloudDownload size={16} className="text-indigo-500" /> Sync จาก Azure DevOps
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {err && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 text-xs">
              <AlertCircle size={13} />{err}
            </div>
          )}
          {result && (
            <div className="px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 text-green-700 dark:text-green-300 text-xs">{result}</div>
          )}
          <div>
            <label className={lc}>Organization URL</label>
            <input type="text" value={orgUrl} onChange={e => setOrgUrl(e.target.value)}
              placeholder="https://dev.azure.com/your-org" className={ic} />
          </div>
          <div>
            <label className={lc}>Project Name</label>
            <input type="text" value={project} onChange={e => setProject(e.target.value)}
              placeholder="ProjectName" className={ic} />
          </div>
          <div>
            <label className={lc}>Personal Access Token (PAT)</label>
            <input type="password" value={pat} onChange={e => setPat(e.target.value)}
              placeholder="xxxx..." className={ic} />
            <p className="text-[10px] text-gray-400 mt-1">Scope ที่ต้องการ: Work Items (Read)</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">ยกเลิก</button>
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60">
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <CloudDownload size={14} />}
              Sync Epic
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, label, count }: {
  active: boolean; onClick: () => void; label: string; count?: number
}) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-indigo-500 text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800'
          : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
      }`}>
      {label}
      {count != null && (
        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
          {count}
        </span>
      )}
    </button>
  )
}

// ─── Epic Table ───────────────────────────────────────────────────────────────

function stripBuzzebees(path: string): string {
  return path.replace(/^Buzzebees\\/i, '').trim()
}

// ─── Stable inline-edit cells (defined at module level to preserve state) ─────

function InlineNumber({ id, value, field, unit, min, max, onSave }: {
  id: string; value: number | null; field: keyof Epic; unit?: string
  min?: number; max?: number; onSave: (id: string, patch: Partial<Epic>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value != null ? String(value) : '')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    setEditing(false)
    const n = draft.trim() === '' ? null : Number(draft)
    const v = isNaN(n as number) ? null : n
    if (v !== value) onSave(id, { [field]: v } as any)
  }

  if (editing) {
    return <input ref={inputRef} type="number" value={draft} min={min} max={max}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value != null ? String(value) : ''); setEditing(false) } }}
      className="border border-indigo-400 rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none w-20" />
  }
  return (
    <span onClick={() => { setDraft(value != null ? String(value) : ''); setEditing(true) }}
      className="cursor-text rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-600 text-xs">
      {value != null ? `${value}${unit ?? ''}` : <span className="text-gray-400 italic">—</span>}
    </span>
  )
}

function InlineText({ id, value, field, multiline, onSave }: {
  id: string; value: string; field: keyof Epic; multiline?: boolean
  onSave: (id: string, patch: Partial<Epic>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  function commit() {
    setEditing(false)
    if (draft !== value) onSave(id, { [field]: draft } as any)
  }

  const cls = 'border border-indigo-400 rounded px-1.5 py-0.5 text-xs bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none w-full'
  if (editing) {
    return multiline
      ? <textarea ref={ref as any} value={draft} rows={2} onChange={e => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
          className={`${cls} resize-none min-w-[160px]`} />
      : <input ref={ref as any} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
          className={cls} style={{ minWidth: 120 }} />
  }
  return (
    <div onClick={() => { setDraft(value); setEditing(true) }}
      className="cursor-text rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-600 max-w-[180px]">
      {value
        ? <span className="block truncate text-xs">{value}</span>
        : <span className="text-gray-400 italic text-[11px]">—</span>}
    </div>
  )
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COL_DEFS = [
  { key: 'no',         label: '#',           sortField: null,              hideable: false, defaultW: 42  },
  { key: 'epicNo',     label: 'Epic No',     sortField: 'epicNo',          hideable: true,  defaultW: 90  },
  { key: 'iteration',  label: 'Iteration',   sortField: null,              hideable: true,  defaultW: 150 },
  { key: 'project',    label: 'Project',     sortField: null,              hideable: true,  defaultW: 160 },
  { key: 'feature',    label: 'Feature',     sortField: null,              hideable: true,  defaultW: 230 },
  { key: 'type',       label: 'Type',        sortField: null,              hideable: true,  defaultW: 80  },
  { key: 'state',      label: 'State',       sortField: 'state',           hideable: true,  defaultW: 110 },
  { key: 'testOwner',  label: 'Test Owner',  sortField: 'testOwner',       hideable: true,  defaultW: 170 },
  { key: 'testLead',   label: 'Test Lead',   sortField: null,              hideable: true,  defaultW: 180 },
  { key: 'estDay',     label: 'Est.(d)',      sortField: 'testEstimateDay', hideable: true,  defaultW: 72  },
  { key: 'testDate',   label: 'Test Date',   sortField: 'testDate',        hideable: true,  defaultW: 100 },
  { key: 'sitDate',    label: 'SIT Date',    sortField: null,              hideable: true,  defaultW: 100 },
  { key: 'uatDate',    label: 'UAT Date',    sortField: 'uatDate',         hideable: true,  defaultW: 100 },
  { key: 'targetDate', label: 'Target Date', sortField: 'targetDate',      hideable: true,  defaultW: 100 },
  { key: 'testingPct', label: 'Testing %',   sortField: 'testingPercent',  hideable: true,  defaultW: 100 },
  { key: 'testerFlag', label: 'Tester Flag', sortField: null,              hideable: true,  defaultW: 190 },
  { key: 'testerNote', label: 'Tester Note', sortField: null,              hideable: true,  defaultW: 190 },
] as const

type ColKey = typeof COL_DEFS[number]['key']
type SortField = 'epicNo' | 'state' | 'targetDate' | 'uatDate' | 'testDate' | 'testEstimateDay' | 'testingPercent' | 'testOwner'

const LS_VIS  = 'epic_visible_cols'
const LS_WIDS = 'epic_col_widths'

function initVisibleCols(): Set<ColKey> {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_VIS) ?? 'null')
    if (Array.isArray(saved)) return new Set(saved as ColKey[])
  } catch {}
  return new Set(COL_DEFS.map(c => c.key))
}
function initColWidths(): Record<string, number> {
  const defaults = Object.fromEntries(COL_DEFS.map(c => [c.key, c.defaultW]))
  try {
    const saved = JSON.parse(localStorage.getItem(LS_WIDS) ?? 'null')
    if (saved && typeof saved === 'object') return { ...defaults, ...saved }
  } catch {}
  return defaults
}

// ─── EpicTable ────────────────────────────────────────────────────────────────

interface TableProps {
  rows: Epic[]
  epics: Epic[]
  savingIds: Set<string>
  employees: { id: string; name: string; displayName: string }[]
  testLeadOptions: string[]
  testerFlags: string[]
  sort: { field: SortField; dir: 'asc' | 'desc' }
  onSort: (f: SortField) => void
  onSave: (id: string, patch: Partial<Epic>) => void
  today: Date
  expanded: boolean
  onToggleExpand: () => void
}

function EpicTable({ rows, savingIds, employees, testLeadOptions, testerFlags, sort, onSort, onSave, today, expanded, onToggleExpand }: TableProps) {
  const todayIso = today.toISOString().slice(0, 10)
  const empNames = employees.map(e => e.name)

  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(initVisibleCols)
  const [colWidths,   setColWidths]   = useState<Record<string, number>>(initColWidths)
  const [showColPanel, setShowColPanel] = useState(false)
  const colPanelRef = useRef<HTMLDivElement>(null)
  const resizeDrag  = useRef<{ col: string; startX: number; startW: number } | null>(null)

  // Persist visibility
  useEffect(() => {
    localStorage.setItem(LS_VIS, JSON.stringify([...visibleCols]))
  }, [visibleCols])
  // Persist widths
  useEffect(() => {
    localStorage.setItem(LS_WIDS, JSON.stringify(colWidths))
  }, [colWidths])

  // Close column panel on outside click
  useEffect(() => {
    if (!showColPanel) return
    function h(e: MouseEvent) {
      if (!colPanelRef.current?.contains(e.target as Node)) setShowColPanel(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showColPanel])

  // Column resize
  function startResize(e: React.MouseEvent, colKey: string) {
    e.preventDefault()
    e.stopPropagation()
    resizeDrag.current = { col: colKey, startX: e.clientX, startW: colWidths[colKey] ?? 100 }
    function onMove(ev: MouseEvent) {
      if (!resizeDrag.current) return
      const delta = ev.clientX - resizeDrag.current.startX
      const newW  = Math.max(48, resizeDrag.current.startW + delta)
      setColWidths(prev => ({ ...prev, [resizeDrag.current!.col]: newW }))
    }
    function onUp() {
      resizeDrag.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }

  const vis = (k: ColKey) => visibleCols.has(k)

  const thBase = 'px-2 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600 relative select-none overflow-hidden'
  const tdBase = 'px-2 py-2 text-xs text-gray-700 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700 align-middle overflow-hidden'

  function Th({ colKey, label, sortField, children }: { colKey: ColKey; label?: string; sortField?: SortField | null; children?: React.ReactNode }) {
    const w = colWidths[colKey]
    return (
      <th className={thBase} style={{ width: w, minWidth: w, maxWidth: w }}
        onClick={() => sortField && onSort(sortField)}>
        <div className={`flex items-center gap-0.5 ${sortField ? 'cursor-pointer' : ''}`}>
          <span className="truncate">{children ?? label}</span>
          {sortField && (sort.field === sortField
            ? (sort.dir === 'asc' ? <ArrowUp size={10} className="shrink-0 text-blue-600" /> : <ArrowDown size={10} className="shrink-0 text-blue-600" />)
            : <span className="text-gray-300 text-[10px] shrink-0">↕</span>
          )}
        </div>
        {/* resize handle */}
        <div
          onMouseDown={e => startResize(e, colKey)}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 1 }}
          className="hover:bg-indigo-400/50"
          onClick={e => e.stopPropagation()}
        />
      </th>
    )
  }

  const visCount = COL_DEFS.filter(c => c.hideable && vis(c.key)).length

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2 mb-2">
        {/* Column visibility */}
        <div className="relative" ref={colPanelRef}>
          <button onClick={() => setShowColPanel(s => !s)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 transition-colors">
            <SlidersHorizontal size={13} /> คอลัมน์ ({visCount}/{COL_DEFS.filter(c => c.hideable).length})
          </button>
          {showColPanel && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl p-3 min-w-[200px] max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100 dark:border-slate-700">
                <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">แสดง/ซ่อน คอลัมน์</span>
                <div className="flex gap-1">
                  <button onClick={() => setVisibleCols(new Set(COL_DEFS.map(c => c.key)))} className="text-[10px] text-indigo-500 hover:underline">ทั้งหมด</button>
                  <span className="text-gray-300">·</span>
                  <button onClick={() => setVisibleCols(new Set(COL_DEFS.filter(c => !c.hideable).map(c => c.key)))} className="text-[10px] text-gray-400 hover:underline">ซ่อนทั้งหมด</button>
                </div>
              </div>
              {COL_DEFS.filter(c => c.hideable).map(col => (
                <label key={col.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 rounded px-1">
                  <input type="checkbox" checked={vis(col.key)}
                    onChange={() => setVisibleCols(prev => {
                      const next = new Set(prev)
                      next.has(col.key) ? next.delete(col.key) : next.add(col.key)
                      return next
                    })}
                    className="w-3.5 h-3.5 accent-indigo-600" />
                  <span className="text-xs text-gray-700 dark:text-slate-200">{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {/* Expand */}
        <button onClick={onToggleExpand}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 transition-colors">
          {expanded ? <><Minimize2 size={13} /> ย่อตาราง</> : <><Maximize2 size={13} /> ขยายตาราง</>}
        </button>
      </div>

      {/* Table */}
      <div className={`overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-600 shadow-sm ${expanded ? 'max-h-[calc(100vh-10rem)]' : 'max-h-[calc(100vh-22rem)]'} overflow-y-auto`}>
        <table className="border-collapse text-sm" style={{ tableLayout: 'fixed', width: COL_DEFS.filter(c => vis(c.key)).reduce((s, c) => s + (colWidths[c.key] ?? c.defaultW), 0) }}>
          <colgroup>
            {COL_DEFS.filter(c => vis(c.key)).map(c => (
              <col key={c.key} style={{ width: colWidths[c.key] ?? c.defaultW }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {vis('no')         && <Th colKey="no"         label="#" />}
              {vis('epicNo')     && <Th colKey="epicNo"     label="Epic No"     sortField="epicNo" />}
              {vis('iteration')  && <Th colKey="iteration"  label="Iteration" />}
              {vis('project')    && <Th colKey="project"    label="Project" />}
              {vis('feature')    && <Th colKey="feature"    label="Feature" />}
              {vis('type')       && <Th colKey="type"       label="Type" />}
              {vis('state')      && <Th colKey="state"      label="State"       sortField="state" />}
              {vis('testOwner')  && <Th colKey="testOwner"  label="Test Owner"  sortField="testOwner" />}
              {vis('testLead')   && <Th colKey="testLead"   label="Test Lead" />}
              {vis('estDay')     && <Th colKey="estDay"     label="Est.(d)"      sortField="testEstimateDay" />}
              {vis('testDate')   && <Th colKey="testDate"   label="Test Date"   sortField="testDate" />}
              {vis('sitDate')    && <Th colKey="sitDate"    label="SIT Date" />}
              {vis('uatDate')    && <Th colKey="uatDate"    label="UAT Date"    sortField="uatDate" />}
              {vis('targetDate') && <Th colKey="targetDate" label="Target Date" sortField="targetDate" />}
              {vis('testingPct') && <Th colKey="testingPct" label="Testing %"   sortField="testingPercent" />}
              {vis('testerFlag') && <Th colKey="testerFlag" label="Tester Flag" />}
              {vis('testerNote') && <Th colKey="testerNote" label="Tester Note" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={visibleCols.size} className="py-12 text-center text-sm text-gray-400">ไม่มีข้อมูล Epic ที่ตรงกับ Filter</td></tr>
            )}
            {rows.map((epic, idx) => {
              const isSaving   = savingIds.has(epic.id)
              const isDelay    = isDelayPlan(epic, todayIso)
              const targetNear = !!epic.targetDate && epic.targetDate >= todayIso && epic.targetDate <= new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10)
              const rowBg      = isSaving ? 'bg-blue-50/40 dark:bg-blue-900/10' : isDelay ? 'bg-amber-50/30 dark:bg-amber-900/10' : 'bg-white dark:bg-slate-800'
              return (
                <tr key={epic.id} className={`${rowBg} hover:bg-blue-50/30 dark:hover:bg-slate-700/40 transition-colors`}>
                  {vis('no')         && <td className={`${tdBase} text-center text-gray-400 text-[11px]`}>{idx + 1}</td>}
                  {vis('epicNo')     && <td className={`${tdBase} font-mono text-blue-700 dark:text-blue-300`}>{epic.epicNo}</td>}
                  {vis('iteration')  && <td className={tdBase}><span className="block truncate text-xs" title={epic.iteration}>{stripBuzzebees(epic.iteration) || '—'}</span></td>}
                  {vis('project')    && <td className={tdBase}><span className="block truncate text-xs" title={epic.project}>{stripBuzzebees(epic.project) || '—'}</span></td>}
                  {vis('feature')    && <td className={tdBase}><span className="block truncate font-medium text-xs" title={epic.feature}>{epic.feature || '—'}</span></td>}
                  {vis('type')       && <td className={tdBase}><span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 truncate block">{epic.itemType || '—'}</span></td>}
                  {vis('state')      && <td className={tdBase}><span className="text-xs truncate block">{epic.state || '—'}</span></td>}
                  {vis('testOwner')  && (
                    <td className={tdBase}>
                      <PortalSelect value={epic.testOwner} options={empNames} placeholder="— Test Owner —" onChange={v => onSave(epic.id, { testOwner: v })} minWidth={180} />
                    </td>
                  )}
                  {vis('testLead')   && (
                    <td className={tdBase}>
                      <PortalSelect value={epic.testLead} options={testLeadOptions} placeholder="— Test Lead —" onChange={v => onSave(epic.id, { testLead: v })} minWidth={200} />
                    </td>
                  )}
                  {vis('estDay')     && <td className={`${tdBase} text-center`}><InlineNumber id={epic.id} value={epic.testEstimateDay} field="testEstimateDay" unit="d" min={0} onSave={onSave} /></td>}
                  {vis('testDate')   && <td className={`${tdBase} whitespace-nowrap`}><span className={`text-xs ${!!epic.testDate && epic.testDate < todayIso ? 'text-red-600 font-semibold' : ''}`}>{fmt(epic.testDate)}</span></td>}
                  {vis('sitDate')    && <td className={`${tdBase} whitespace-nowrap text-xs`}>{fmt(epic.sitDate)}</td>}
                  {vis('uatDate')    && <td className={`${tdBase} whitespace-nowrap text-xs`}>{fmt(epic.uatDate)}</td>}
                  {vis('targetDate') && <td className={`${tdBase} whitespace-nowrap`}><span className={`text-xs ${targetNear ? 'font-bold text-orange-600' : ''}`}>{fmt(epic.targetDate)}</span></td>}
                  {vis('testingPct') && (
                    <td className={tdBase}>
                      {epic.testingPercent != null && (
                        <div className="w-full h-1 rounded-full bg-gray-200 dark:bg-slate-600 overflow-hidden mb-0.5">
                          <div className={`h-full rounded-full ${epic.testingPercent >= 100 ? 'bg-green-500' : epic.testingPercent >= 50 ? 'bg-blue-400' : 'bg-orange-400'}`}
                            style={{ width: `${Math.min(100, epic.testingPercent)}%` }} />
                        </div>
                      )}
                      <InlineNumber id={epic.id} value={epic.testingPercent} field="testingPercent" unit="%" min={0} max={100} onSave={onSave} />
                    </td>
                  )}
                  {vis('testerFlag') && (
                    <td className={tdBase}>
                      <TesterFlagCell selected={epic.testerFlag} masterFlags={testerFlags} onChange={v => onSave(epic.id, { testerFlag: v })} />
                    </td>
                  )}
                  {vis('testerNote') && <td className={tdBase}><InlineText id={epic.id} value={epic.testerNote} field="testerNote" multiline onSave={onSave} /></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

type Tab = 'table' | 'gantt' | 'deployed' | 'delayplan'

export default function EpicView() {
  const { employees, publicHolidays } = useApp()
  const holidaySet = useMemo(() => new Set<string>(publicHolidays.map((h: any) => h.date ?? h)), [publicHolidays])
  const activeEmployees = useMemo(() =>
    employees
      .filter((e: Employee) => e.isActive !== false)
      .map((e: Employee) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`.trim(),
        displayName: `${e.firstName} ${e.lastName}${e.nickname ? ` (${e.nickname})` : ''}`.trim(),
      }))
  , [employees])

  const testLeadOptions = useMemo(() =>
    employees
      .filter((e: Employee) => e.isActive !== false && (e.position === 'QA Manager' || e.position === 'QA Lead'))
      .map((e: Employee) => `${e.firstName} ${e.lastName}${e.nickname ? ` (${e.nickname})` : ''}`.trim())
  , [employees])

  const [epics,       setEpics]       = useState<Epic[]>([])
  const [testerFlags, setTesterFlags] = useState<string[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [conflictMsg, setConflictMsg] = useState<string | null>(null)
  const [savingIds,   setSavingIds]   = useState<Set<string>>(new Set())
  const [tab,         setTab]         = useState<Tab>('table')
  const [showSync,    setShowSync]    = useState(false)
  const [syncing,     setSyncing]     = useState(false)
  const [syncMsg,     setSyncMsg]     = useState<string | null>(null)
  const [expanded,    setExpanded]    = useState(false)

  // Filters
  const [search,       setSearch]       = useState('')
  const [filterOwner,  setFilterOwner]  = useState('')
  const [filterState,  setFilterState]  = useState('')
  const [filterIter,   setFilterIter]   = useState('')

  // Sort
  const [sort, setSort] = useState<{ field: SortField; dir: 'asc' | 'desc' }>({ field: 'epicNo', dir: 'asc' })

  const epicsRef = useRef<Epic[]>([])
  useEffect(() => { epicsRef.current = epics }, [epics])
  const today = useMemo(() => new Date(), [])
  const todayIso = today.toISOString().slice(0, 10)

  // ── Load ──────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [data, { planningDb }] = await Promise.all([
        epicDb.getAll(),
        import('../../lib/planningDb'),
      ])
      setEpics(data)
      const flags = await planningDb.getTesterFlags()
      setTesterFlags(flags)
    } catch (e: any) {
      setError(e.message ?? 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  // ── Autosave ──────────────────────────────────────────────────────────────────
  const noteTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  async function autoSave(id: string, patch: Partial<Epic>) {
    const epic = epicsRef.current.find(e => e.id === id)
    if (!epic) return

    // Optimistic update
    const updated = { ...epic, ...patch }
    // Recalculate test_date if estimate or uat/target changed
    if ('testEstimateDay' in patch || 'uatDate' in patch || 'targetDate' in patch) {
      updated.testDate = calcEpicTestDate(updated.uatDate, updated.targetDate, updated.testEstimateDay, holidaySet)
    }
    setEpics(prev => prev.map(e => e.id === id ? updated : e))
    setSavingIds(prev => new Set([...prev, id]))

    const fields: Record<string, unknown> = {}
    if ('testEstimateDay' in patch) fields.test_estimate_day = patch.testEstimateDay ?? null
    if ('testingPercent'  in patch) fields.testing_percent   = patch.testingPercent  ?? null
    if ('testerFlag'      in patch) fields.tester_flag       = (patch.testerFlag ?? []).length ? patch.testerFlag : null
    if ('testerNote'      in patch) fields.tester_note       = patch.testerNote ?? ''
    if ('testOwner'       in patch) fields.test_owner        = patch.testOwner ?? ''
    if ('testLead'        in patch) fields.test_lead         = patch.testLead  ?? ''
    // recalculated test_date
    if ('testEstimateDay' in patch || 'uatDate' in patch || 'targetDate' in patch) {
      fields.test_date = updated.testDate
    }

    try {
      const result = await epicDb.updateFieldsChecked(id, fields, epic.updatedAt)
      if (result.ok) {
        setEpics(prev => prev.map(e => e.id === id ? { ...e, updatedAt: result.updatedAt } : e))
        setConflictMsg(null)
      } else if (result.reason === 'conflict') {
        setConflictMsg('⚠️ ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น — กรุณากด Refresh')
        await load()
      } else {
        setConflictMsg('บันทึกไม่สำเร็จ กรุณาลองใหม่')
      }
    } catch {
      setConflictMsg('บันทึกไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  function handleSave(id: string, patch: Partial<Epic>) {
    if ('testerNote' in patch) {
      setEpics(prev => prev.map(e => e.id === id ? { ...e, testerNote: patch.testerNote! } : e))
      if (noteTimers.current.has(id)) clearTimeout(noteTimers.current.get(id)!)
      noteTimers.current.set(id, setTimeout(() => {
        const e = epicsRef.current.find(x => x.id === id)
        autoSave(id, { testerNote: patch.testerNote!, updatedAt: e?.updatedAt } as any)
      }, 800))
    } else {
      autoSave(id, patch)
    }
  }

  // ── Azure DevOps Sync ────────────────────────────────────────────────────────
  async function handleSync(cfg: AzureDevOpsConfig) {
    setSyncing(true); setShowSync(false); setSyncMsg(null)
    try {
      const result = await syncEpicsFromAdo(cfg, holidaySet)
      const debugPaths = result.samplePaths.length
        ? ` | ตัวอย่าง IterationPath: ${result.samplePaths.slice(0, 3).join(' / ')}`
        : ''
      const filterNote = result.totalFromAdo > 0 && result.total === 0
        ? ` ⚠️ พบ ${result.totalFromAdo} Epics แต่ถูก filter ออกทั้งหมด (IterationPath ≤ 230)${debugPaths}`
        : result.totalFromAdo === 0
        ? ' ⚠️ ไม่พบ Epic ใน Azure DevOps (ตรวจ Project Name และ PAT)'
        : ` (พบทั้งหมด ${result.totalFromAdo}, ผ่าน filter ${result.total})`
      setSyncMsg(`Sync เสร็จ: เพิ่ม ${result.inserted} แถว, อัปเดต ${result.updated} แถว${filterNote}${result.errors.length ? ` | error ${result.errors.length}: ${result.errors[0]}` : ''}`)
      await load()
    } catch (e: any) {
      setSyncMsg(`Sync ล้มเหลว: ${e.message}`)
    } finally {
      setSyncing(false)
    }
  }

  // ── Sort ──────────────────────────────────────────────────────────────────────
  function handleSort(field: SortField) {
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' })
  }

  function applySort(list: Epic[]): Epic[] {
    return [...list].sort((a, b) => {
      const va = (a as any)[sort.field] ?? ''
      const vb = (b as any)[sort.field] ?? ''
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }

  // ── Filter + tab data ─────────────────────────────────────────────────────────
  function applyFilters(list: Epic[]): Epic[] {
    return list.filter(e => {
      if (search && !e.feature.toLowerCase().includes(search.toLowerCase()) && !e.project.toLowerCase().includes(search.toLowerCase())) return false
      if (filterOwner && e.testOwner !== filterOwner) return false
      if (filterState && e.state !== filterState) return false
      if (filterIter  && !e.iteration.includes(filterIter)) return false
      return true
    })
  }

  const mainEpics     = useMemo(() => epics.filter(e => !isDeployedEpic(e)), [epics])
  const deployedEpics = useMemo(() => epics.filter(e => isDeployedEpic(e)), [epics])
  const delayEpics    = useMemo(() => mainEpics.filter(e => isDelayPlan(e, todayIso)), [mainEpics, todayIso])

  const tableRows  = useMemo(() => applySort(applyFilters(mainEpics)), [mainEpics, search, filterOwner, filterState, filterIter, sort])
  const ganttRows  = useMemo(() => tableRows.map(epicToProject), [tableRows])
  const deployRows = useMemo(() => applySort(deployedEpics), [deployedEpics, sort])
  const delayRows  = useMemo(() => applySort(delayEpics), [delayEpics, sort])

  const uniqueStates = useMemo(() => [...new Set(epics.map(e => e.state).filter(Boolean))].sort(), [epics])
  const uniqueIters  = useMemo(() => [...new Set(epics.map(e => {
    const m = e.iteration.match(/(\d+)\s*$/)
    return m ? m[1] : ''
  }).filter(Boolean))].sort((a, b) => Number(a) - Number(b)), [epics])

  return (
    <div className="flex flex-col gap-4 p-4 min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Epic (Azure DevOps)</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{epics.length} Epics (IterationPath &gt; 230)</p>
        </div>
        <div className="flex items-center gap-2">
          {savingIds.size > 0 && (
            <span className="flex items-center gap-1 text-xs text-blue-500">
              <Loader2 size={12} className="animate-spin" /> กำลังบันทึก...
            </span>
          )}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 text-sm font-medium hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => setShowSync(true)} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-60">
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <CloudDownload size={14} />}
            Sync Azure DevOps
          </button>
        </div>
      </div>

      {/* Conflict / Sync messages */}
      {conflictMsg && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{conflictMsg}</span>
          <button onClick={() => setConflictMsg(null)}><X size={15} /></button>
        </div>
      )}
      {syncMsg && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 text-sm">
          <span className="flex-1">{syncMsg}</span>
          <button onClick={() => setSyncMsg(null)}><X size={15} /></button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-600 text-sm">
          <AlertCircle size={16} />{error}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="flex gap-1 px-4 pt-2 border-b border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 overflow-x-auto">
          <TabBtn active={tab === 'table'}    onClick={() => setTab('table')}    label="Epic Table"    count={mainEpics.length} />
          <TabBtn active={tab === 'gantt'}    onClick={() => setTab('gantt')}    label="Gantt View" />
          <TabBtn active={tab === 'deployed'} onClick={() => setTab('deployed')} label="Deployed"      count={deployedEpics.length} />
          <TabBtn active={tab === 'delayplan'} onClick={() => setTab('delayplan')} label="Delay Plan"  count={delayEpics.length} />
        </div>

        {/* Filters (table + gantt tabs) */}
        {(tab === 'table' || tab === 'gantt') && (
          <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-gray-100 dark:border-slate-700">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหา Feature / Project..."
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-56" />
            <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 focus:outline-none">
              <option value="">ทุก Test Owner</option>
              {activeEmployees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            <select value={filterState} onChange={e => setFilterState(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 focus:outline-none">
              <option value="">ทุก State</option>
              {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterIter} onChange={e => setFilterIter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 focus:outline-none">
              <option value="">ทุก Iteration</option>
              {uniqueIters.map(i => <option key={i} value={i}>Sprint {i}</option>)}
            </select>
            {(search || filterOwner || filterState || filterIter) && (
              <button onClick={() => { setSearch(''); setFilterOwner(''); setFilterState(''); setFilterIter('') }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X size={12} /> ล้าง Filter
              </button>
            )}
            <span className="ml-auto text-xs text-gray-400 dark:text-slate-500 self-center">{tableRows.length} รายการ</span>
          </div>
        )}

        {/* Tab content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
              <Loader2 size={22} className="animate-spin text-indigo-500" />
              <span className="text-sm">กำลังโหลด...</span>
            </div>
          ) : tab === 'table' ? (
            <EpicTable
              rows={tableRows} epics={epics} savingIds={savingIds}
              employees={activeEmployees} testLeadOptions={testLeadOptions} testerFlags={testerFlags}
              sort={sort} onSort={handleSort} onSave={handleSave} today={today}
              expanded={expanded} onToggleExpand={() => setExpanded(e => !e)}
            />
          ) : tab === 'gantt' ? (
            <TesterGanttView
              projects={ganttRows}
              holidays={holidaySet}
              employees={employees}
              today={today}
            />
          ) : tab === 'deployed' ? (
            <EpicTable
              rows={deployRows} epics={epics} savingIds={savingIds}
              employees={activeEmployees} testLeadOptions={testLeadOptions} testerFlags={testerFlags}
              sort={sort} onSort={handleSort} onSave={handleSave} today={today}
              expanded={expanded} onToggleExpand={() => setExpanded(e => !e)}
            />
          ) : tab === 'delayplan' ? (
            <div>
              <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-amber-700 dark:text-amber-300 text-xs">
                <AlertTriangle size={13} />
                Epic ที่ Target Date / UAT Date เลยกำหนดแล้ว และยังไม่ Deployed
              </div>
              <EpicTable
                rows={delayRows} epics={epics} savingIds={savingIds}
                employees={activeEmployees} testLeadOptions={testLeadOptions} testerFlags={testerFlags}
                sort={sort} onSort={handleSort} onSave={handleSave} today={today}
                expanded={expanded} onToggleExpand={() => setExpanded(e => !e)}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Sync modal */}
      {showSync && (
        <AdoConfigModal
          onSync={handleSync}
          onClose={() => setShowSync(false)}
        />
      )}
    </div>
  )
}
