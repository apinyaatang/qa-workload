import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Trash2, Loader2, AlertCircle, X, RefreshCw, ChevronDown, Save } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { extraTaskDb } from '../../lib/extraTaskDb'
import { ALL_STATUSES } from '../planning/PlanningView'
import { EXTRA_TASK_TYPES } from '../../types/extraTask'
import type { ExtraTask, ExtraTaskType } from '../../types/extraTask'

// ── Portal dropdown (escapes overflow clipping) ────────────────────────────────

function PortalSelect({
  value,
  options,
  placeholder,
  onChange,
  className,
}: {
  value: string
  options: readonly string[]
  placeholder?: string
  onChange: (v: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0, width: 160 })
  const trigRef  = useRef<HTMLButtonElement>(null)
  const menuRef  = useRef<HTMLDivElement>(null)

  const openMenu = useCallback(() => {
    if (!trigRef.current) return
    const r = trigRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + window.scrollY + 2, left: r.left + window.scrollX, width: r.width })
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
    <>
      <button
        ref={trigRef}
        type="button"
        onClick={() => open ? setOpen(false) : openMenu()}
        className={`flex items-center justify-between gap-1 text-left ${className ?? ''}`}
      >
        <span className={value ? '' : 'text-gray-400 dark:text-slate-500 italic'}>
          {value || placeholder || '—'}
        </span>
        <ChevronDown size={11} className="shrink-0 text-gray-400" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 9999 }}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto"
        >
          {placeholder && (
            <div
              className="px-3 py-1.5 text-xs text-gray-400 dark:text-slate-500 italic cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700"
              onMouseDown={() => { onChange(''); setOpen(false) }}
            >
              {placeholder}
            </div>
          )}
          {options.map(opt => (
            <div
              key={opt}
              onMouseDown={() => { onChange(opt); setOpen(false) }}
              className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 ${
                opt === value ? 'font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/20' : 'text-gray-700 dark:text-slate-200'
              }`}
            >
              {opt}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

// ── Add/Edit modal ─────────────────────────────────────────────────────────────

interface FormState {
  tester:         string
  projectName:    string
  type:           string
  status:         string
  goLiveDate:     string
  testingPercent: string
  remark:         string
}

const EMPTY_FORM: FormState = {
  tester: '', projectName: '', type: '', status: '',
  goLiveDate: '', testingPercent: '', remark: '',
}

function TaskModal({
  task,
  employees,
  onSave,
  onClose,
}: {
  task: ExtraTask | null   // null = new
  employees: { id: string; name: string }[]
  onSave: (form: FormState) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<FormState>(
    task ? {
      tester:         task.tester         ?? '',
      projectName:    task.projectName,
      type:           task.type,
      status:         task.status,
      goLiveDate:     task.goLiveDate     ?? '',
      testingPercent: task.testingPercent != null ? String(task.testingPercent) : '',
      remark:         task.remark         ?? '',
    } : EMPTY_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState<string | null>(null)

  function set(k: keyof FormState, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.projectName.trim()) { setErr('กรุณากรอก Project Name'); return }
    setSaving(true)
    try {
      await onSave(form)
    } catch {
      setErr('บันทึกไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400'
  const labelCls = 'block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1'
  const dropCls  = `${inputCls} flex items-center justify-between gap-1 cursor-pointer`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            {task ? 'แก้ไขงาน Extra Task' : 'เพิ่มงาน Extra Task'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-300 text-xs">
              <AlertCircle size={13} />
              {err}
            </div>
          )}

          <div>
            <label className={labelCls}>Project Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.projectName}
              onChange={e => set('projectName', e.target.value)}
              placeholder="ชื่อ Project / งาน"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tester</label>
              <PortalSelect
                value={form.tester}
                options={employees.map(e => e.name)}
                placeholder="— เลือก Tester —"
                onChange={v => set('tester', v)}
                className={dropCls}
              />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <PortalSelect
                value={form.type}
                options={EXTRA_TASK_TYPES}
                placeholder="— เลือก Type —"
                onChange={v => set('type', v)}
                className={dropCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Status</label>
            <PortalSelect
              value={form.status}
              options={ALL_STATUSES}
              placeholder="— เลือก Status —"
              onChange={v => set('status', v)}
              className={dropCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Go Live Date</label>
              <input
                type="date"
                value={form.goLiveDate}
                onChange={e => set('goLiveDate', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Testing %</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={form.testingPercent}
                onChange={e => set('testingPercent', e.target.value)}
                placeholder="0–100"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Remark</label>
            <textarea
              rows={2}
              value={form.remark}
              onChange={e => set('remark', e.target.value)}
              placeholder="หมายเหตุ (ถ้ามี)"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── TYPE badge ─────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  'Urgent':           'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
  'Issue PRD':        'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200',
  'Improve':          'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200',
  'Internal Request': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200',
  'Other':            'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200',
}

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLOR[type] ?? TYPE_COLOR['Other']
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap ${cls}`}>
      {type || '—'}
    </span>
  )
}

// ── Testing% bar ──────────────────────────────────────────────────────────────

function TestingBar({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-gray-400 dark:text-slate-500 text-xs">—</span>
  const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-400' : 'bg-orange-400'
  const textColor = pct >= 100 ? 'text-green-600 dark:text-green-400' : pct >= 50 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-500 dark:text-orange-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 rounded-full bg-gray-200 dark:bg-slate-600 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-[11px] font-semibold ${textColor}`}>{pct}%</span>
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────────────────────

export default function ExtraTaskView() {
  const { employees } = useApp()
  const activeEmployees = employees.filter(e => e.isActive).map(e => ({ id: e.id, name: `${e.firstName} ${e.lastName}`.trim() }))

  const [tasks,       setTasks]       = useState<ExtraTask[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [conflictMsg, setConflictMsg] = useState<string | null>(null)
  const [savingIds,   setSavingIds]   = useState<Set<string>>(new Set())
  const [deleting,    setDeleting]    = useState<Set<string>>(new Set())
  const [modal,       setModal]       = useState<'add' | ExtraTask | null>(null)
  const [search,      setSearch]      = useState('')
  const [filterType,  setFilterType]  = useState('')
  const [filterTester,setFilterTester]= useState('')
  const tasksRef = useRef<ExtraTask[]>([])
  useEffect(() => { tasksRef.current = tasks }, [tasks])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await extraTaskDb.getAll()
      setTasks(data)
    } catch (e: any) {
      setError(e.message ?? 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Autosave ──────────────────────────────────────────────────────────────

  async function autoSave(id: string, fields: Record<string, unknown>, knownUpdatedAt?: string) {
    setSavingIds(prev => new Set([...prev, id]))
    try {
      const result = await extraTaskDb.updateFieldsChecked(id, fields, knownUpdatedAt)
      if (result.ok) {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, updatedAt: result.updatedAt } : t))
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

  // ── Add / Edit modal save ──────────────────────────────────────────────────

  async function handleModalSave(form: FormState) {
    const pct = form.testingPercent !== '' ? Number(form.testingPercent) : null
    if (modal === 'add') {
      const created = await extraTaskDb.insert({
        tester:         form.tester || null,
        projectName:    form.projectName.trim(),
        type:           form.type as ExtraTaskType,
        status:         form.status,
        goLiveDate:     form.goLiveDate || null,
        testingPercent: pct,
        remark:         form.remark || null,
      })
      setTasks(prev => [created, ...prev])
    } else if (modal && typeof modal !== 'string') {
      const task = modal as ExtraTask
      const fields: Record<string, unknown> = {
        tester:          form.tester || null,
        project_name:    form.projectName.trim(),
        type:            form.type || null,
        status:          form.status || null,
        go_live_date:    form.goLiveDate || null,
        testing_percent: pct,
        remark:          form.remark || null,
      }
      await autoSave(task.id, fields, task.updatedAt)
      setTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        tester:         form.tester || null,
        projectName:    form.projectName.trim(),
        type:           form.type as ExtraTaskType,
        status:         form.status,
        goLiveDate:     form.goLiveDate || null,
        testingPercent: pct,
        remark:         form.remark || null,
      } : t))
    }
    setModal(null)
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!window.confirm('ต้องการลบงานนี้ใช่มั้ย?')) return
    setDeleting(prev => new Set([...prev, id]))
    try {
      await extraTaskDb.deleteById(id)
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch {
      setConflictMsg('ลบไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setDeleting(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  // ── Filter ────────────────────────────────────────────────────────────────

  const visible = tasks.filter(t => {
    if (search && !t.projectName.toLowerCase().includes(search.toLowerCase()) && !(t.tester ?? '').toLowerCase().includes(search.toLowerCase())) return false
    if (filterType && t.type !== filterType) return false
    if (filterTester && t.tester !== filterTester) return false
    return true
  })

  function fmtDate(iso: string | null | undefined) {
    if (!iso) return '—'
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  const thCls = 'px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap bg-gray-50 dark:bg-slate-700/80 border-b border-gray-200 dark:border-slate-600'
  const tdCls = 'px-3 py-2 text-xs text-gray-700 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700 align-middle'

  return (
    <div className="flex flex-col gap-4 p-4 min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Extra Task</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">งานนอก Plan — {tasks.length} รายการ</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 text-sm font-medium hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            {savingIds.size > 0
              ? <Loader2 size={14} className="animate-spin text-blue-500" />
              : <RefreshCw size={14} />}
            Refresh
          </button>
          <button
            onClick={() => setModal('add')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <Plus size={15} />
            เพิ่มงาน
          </button>
        </div>
      </div>

      {/* Conflict banner */}
      {conflictMsg && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{conflictMsg}</span>
          <button onClick={() => setConflictMsg(null)} className="shrink-0"><X size={15} /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหา Project / Tester..."
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-56"
        />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">ทุก Type</option>
          {EXTRA_TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterTester}
          onChange={e => setFilterTester(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">ทุก Tester</option>
          {activeEmployees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
        </select>
        {(search || filterType || filterTester) && (
          <button
            onClick={() => { setSearch(''); setFilterType(''); setFilterTester('') }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
          >
            <X size={12} /> ล้าง Filter
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 dark:text-slate-500">{visible.length} รายการ</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-400 dark:text-slate-500">
          <Loader2 size={22} className="animate-spin text-indigo-500" />
          <span className="text-sm">กำลังโหลด...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-300 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400 dark:text-slate-500">
          <p className="text-sm">{tasks.length === 0 ? 'ยังไม่มีงาน Extra Task' : 'ไม่พบรายการที่ตรงกับ Filter'}</p>
          {tasks.length === 0 && (
            <button onClick={() => setModal('add')} className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 text-sm hover:underline">
              <Plus size={14} /> เพิ่มงานแรก
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-600 shadow-sm">
          <table className="min-w-full border-collapse">
            <thead>
              <tr>
                <th className={`${thCls} w-8`}>#</th>
                <th className={thCls}>Project Name</th>
                <th className={thCls}>Type</th>
                <th className={thCls}>Tester</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Go Live</th>
                <th className={thCls}>Testing %</th>
                <th className={thCls}>Remark</th>
                <th className={`${thCls} w-16`}></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((task, idx) => {
                const isSaving  = savingIds.has(task.id)
                const isDeleting = deleting.has(task.id)
                return (
                  <tr
                    key={task.id}
                    className={`group transition-colors ${
                      isSaving
                        ? 'bg-blue-50/40 dark:bg-blue-900/10'
                        : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <td className={`${tdCls} text-center text-gray-400 dark:text-slate-500`}>{idx + 1}</td>

                    <td className={tdCls}>
                      <button
                        onClick={() => setModal(task)}
                        className="font-medium text-indigo-700 dark:text-indigo-300 hover:underline text-left max-w-[260px] truncate block"
                        title={task.projectName}
                      >
                        {task.projectName}
                      </button>
                    </td>

                    <td className={tdCls}>
                      <TypeBadge type={task.type} />
                    </td>

                    <td className={tdCls}>
                      <span className="text-gray-700 dark:text-slate-200">
                        {task.tester || <span className="text-gray-400 dark:text-slate-500 italic">—</span>}
                      </span>
                    </td>

                    <td className={tdCls}>
                      <span className="text-[11px] text-gray-600 dark:text-slate-300 max-w-[200px] truncate block" title={task.status}>
                        {task.status || '—'}
                      </span>
                    </td>

                    <td className={`${tdCls} whitespace-nowrap`}>{fmtDate(task.goLiveDate)}</td>

                    <td className={tdCls}>
                      <TestingBar pct={task.testingPercent} />
                    </td>

                    <td className={tdCls}>
                      <span className="text-gray-500 dark:text-slate-400 max-w-[160px] truncate block" title={task.remark ?? ''}>
                        {task.remark || '—'}
                      </span>
                    </td>

                    <td className={tdCls}>
                      <div className="flex items-center gap-1 justify-end">
                        {isSaving && <Loader2 size={12} className="animate-spin text-blue-400" />}
                        <button
                          onClick={() => handleDelete(task.id)}
                          disabled={isDeleting}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-all disabled:opacity-50"
                          title="ลบ"
                        >
                          {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <TaskModal
          task={modal === 'add' ? null : modal}
          employees={activeEmployees}
          onSave={handleModalSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
