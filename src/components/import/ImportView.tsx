import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, Trash2, PlayCircle, Eye, Download } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { parseWorkbook } from '../../utils/importParser'
import type { ImportSession } from '../../types'
import { formatDate } from '../../utils/dateUtils'
import * as XLSX from 'xlsx'

export default function ImportView() {
  const { employees, selectedPeriod, importSessions, addImportSession, applyImportSession, deleteImportSession } = useApp()
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState<ImportSession | null>(null)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function processFile(file: File) {
    if (!file) return
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      alert('รองรับเฉพาะไฟล์ .xlsx, .xls, .csv เท่านั้น')
      return
    }
    setParsing(true)
    try {
      const buffer = await file.arrayBuffer()
      const rows = parseWorkbook(buffer, employees, selectedPeriod.startDate, selectedPeriod.endDate)
      const successRows = rows.filter(r => !r.error).length
      const errorRows = rows.filter(r => !!r.error).length
      const session: ImportSession = {
        id: `import-${Date.now()}`,
        fileName: file.name,
        importedAt: new Date().toISOString(),
        importStatus: errorRows === 0 ? 'success' : successRows === 0 ? 'error' : 'partial',
        totalRows: rows.length,
        successRows,
        errorRows,
        rows,
        appliedToTasks: false,
      }
      setPreview(session)
    } finally {
      setParsing(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  function confirmImport() {
    if (!preview) return
    addImportSession(preview)
    setPreview(null)
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Task ID', 'Task Name', 'Assignee', 'Estimated Hours', 'Deadline', 'Status', 'Project', 'Period Start', 'Period End'],
      ['TASK-001', 'ตัวอย่างงาน', `${employees[0]?.firstName ?? 'ชื่อพนักงาน'} ${employees[0]?.lastName ?? ''}`, 8, '2026-05-31', 'Pending', '', selectedPeriod.startDate, selectedPeriod.endDate],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks')
    XLSX.writeFile(wb, 'import_template.xlsx')
  }

  return (
    <div className="space-y-5">
      {/* Upload Zone */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Import Planned Tasks</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              อัปโหลดไฟล์ Excel / CSV เพื่อ Import Tasks เข้าระบบ — Period: <strong className="text-indigo-600">{selectedPeriod.label}</strong>
            </p>
          </div>
          <button onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Download size={14} /> ดาวน์โหลด Template
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
          }`}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
          {parsing ? (
            <div className="space-y-2">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-500">กำลังอ่านไฟล์...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto">
                <Upload size={24} className="text-indigo-500" />
              </div>
              <div>
                <p className="font-semibold text-gray-700">ลากไฟล์มาวาง หรือ คลิกเพื่อเลือกไฟล์</p>
                <p className="text-sm text-gray-400 mt-1">รองรับ .xlsx, .xls, .csv</p>
              </div>
              <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600">
                <FileSpreadsheet size={15} className="text-green-600" /> เลือกไฟล์
              </div>
            </div>
          )}
        </div>

        {/* Column Guide */}
        <div className="mt-4 bg-slate-50 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-600 mb-2">คอลัมน์ที่รองรับ</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { col: 'Task ID', desc: 'รหัส Task (optional)', req: false },
              { col: 'Task Name', desc: 'ชื่องาน', req: true },
              { col: 'Assignee', desc: 'ชื่อพนักงาน', req: false },
              { col: 'Estimated Hours', desc: 'จำนวนชั่วโมง', req: true },
              { col: 'Deadline', desc: 'วันสิ้นสุด', req: true },
              { col: 'Status', desc: 'Pending/In-Progress/Done', req: false },
              { col: 'Period Start', desc: 'วันเริ่ม Period', req: false },
              { col: 'Period End', desc: 'วันสิ้นสุด Period', req: false },
            ].map(c => (
              <div key={c.col} className="flex items-start gap-1.5">
                {c.req
                  ? <span className="text-red-400 text-xs mt-0.5">*</span>
                  : <span className="text-gray-300 text-xs mt-0.5">○</span>}
                <div>
                  <p className="text-xs font-medium text-gray-700 font-mono">{c.col}</p>
                  <p className="text-xs text-gray-400">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {preview && (
        <PreviewPanel
          session={preview}
          employees={employees}
          onConfirm={confirmImport}
          onCancel={() => setPreview(null)}
        />
      )}

      {/* Import History */}
      {importSessions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">ประวัติการ Import ({importSessions.length})</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {importSessions.map(s => (
              <SessionRow
                key={s.id}
                session={s}
                expanded={expandedSession === s.id}
                onToggle={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                onApply={() => applyImportSession(s.id)}
                onDelete={() => deleteImportSession(s.id)}
                employees={employees}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Preview Panel ────────────────────────────────────────────────────────────
function PreviewPanel({ session, employees, onConfirm, onCancel }: {
  session: ImportSession
  employees: { id: string; firstName: string; lastName: string }[]
  onConfirm: () => void
  onCancel: () => void
}) {
  const [showErrors, setShowErrors] = useState(false)

  return (
    <div className="bg-white rounded-xl border-2 border-indigo-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet size={20} className="text-indigo-600" />
          <div>
            <p className="font-bold text-gray-900">{session.fileName}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-gray-600">{session.totalRows} แถว</span>
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <CheckCircle size={11} /> {session.successRows} ผ่าน
              </span>
              {session.errorRows > 0 && (
                <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                  <XCircle size={11} /> {session.errorRows} มีข้อผิดพลาด
                </span>
              )}
            </div>
          </div>
        </div>
        <div className={`text-xs px-3 py-1.5 rounded-full font-medium ${
          session.importStatus === 'success' ? 'bg-green-100 text-green-700'
          : session.importStatus === 'error' ? 'bg-red-100 text-red-700'
          : 'bg-yellow-100 text-yellow-700'
        }`}>
          {session.importStatus === 'success' ? '✓ ผ่านทั้งหมด' : session.importStatus === 'error' ? '✗ ผิดพลาดทั้งหมด' : '⚠ บางแถวมีปัญหา'}
        </div>
      </div>

      {/* Toggle error rows */}
      {session.errorRows > 0 && (
        <button
          onClick={() => setShowErrors(!showErrors)}
          className="w-full flex items-center gap-2 px-5 py-2.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 border-b border-red-100 transition-colors"
        >
          <AlertCircle size={13} />
          แสดงแถวที่มีข้อผิดพลาด ({session.errorRows} แถว)
          {showErrors ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      )}

      {/* Data Table */}
      <div className="overflow-x-auto max-h-80">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-500 sticky top-0">
              <th className="text-left px-4 py-2 font-medium">แถว</th>
              <th className="text-left px-4 py-2 font-medium">Task Name</th>
              <th className="text-left px-4 py-2 font-medium">Assignee</th>
              <th className="text-right px-4 py-2 font-medium">Hours</th>
              <th className="text-left px-4 py-2 font-medium">Deadline</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">สถานะ Import</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {session.rows
              .filter(r => showErrors || !r.error)
              .map(r => {
                const emp = r.assigneeId ? employees.find(e => e.id === r.assigneeId) : null
                return (
                  <tr key={r.rowNo} className={r.error ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-2 text-gray-400 font-mono">{r.rowNo}</td>
                    <td className="px-4 py-2 font-medium text-gray-800 max-w-[180px] truncate">{r.taskName ?? '—'}</td>
                    <td className="px-4 py-2">
                      {emp ? `${emp.firstName} ${emp.lastName}` : (
                        <span className={r.assigneeRaw ? 'text-red-500' : 'text-gray-300'}>
                          {r.assigneeRaw ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{r.estimatedHours ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.deadline ? formatDate(r.deadline) : '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.status ?? 'Pending'}</td>
                    <td className="px-4 py-2">
                      {r.error ? (
                        <span className="flex items-start gap-1 text-red-600">
                          <XCircle size={12} className="shrink-0 mt-0.5" /> {r.error}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle size={12} /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
        <p className="text-xs text-gray-500">
          {session.successRows > 0
            ? `จะ Import ${session.successRows} Tasks เข้าระบบ (แทนที่ Planned Tasks เดิมใน Period นี้)`
            : 'ไม่มีแถวที่สามารถ Import ได้'}
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100">
            ยกเลิก
          </button>
          {session.successRows > 0 && (
            <button onClick={onConfirm}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              <PlayCircle size={15} /> บันทึก Raw Data
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Session Row ──────────────────────────────────────────────────────────────
function SessionRow({ session, expanded, onToggle, onApply, onDelete, employees }: {
  session: ImportSession
  expanded: boolean
  onToggle: () => void
  onApply: () => void
  onDelete: () => void
  employees: { id: string; firstName: string; lastName: string }[]
}) {
  const dt = new Date(session.importedAt)
  const dtStr = `${dt.toLocaleDateString('th-TH')} ${dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`

  return (
    <div>
      <div className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          session.importStatus === 'success' ? 'bg-green-100' : session.importStatus === 'error' ? 'bg-red-100' : 'bg-yellow-100'
        }`}>
          {session.importStatus === 'success'
            ? <CheckCircle size={16} className="text-green-600" />
            : session.importStatus === 'error'
            ? <XCircle size={16} className="text-red-500" />
            : <AlertCircle size={16} className="text-yellow-600" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-gray-900 text-sm truncate">{session.fileName}</p>
            {session.appliedToTasks && (
              <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">Applied ✓</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            <span>{dtStr}</span>
            <span className="text-green-600 font-medium">{session.successRows} ผ่าน</span>
            {session.errorRows > 0 && <span className="text-red-500 font-medium">{session.errorRows} ข้อผิดพลาด</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!session.appliedToTasks && session.successRows > 0 && (
            <button onClick={onApply}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">
              <PlayCircle size={13} /> Apply to Tasks
            </button>
          )}
          <button onClick={onToggle} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            {expanded ? <ChevronUp size={16} /> : <Eye size={16} />}
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Expanded rows */}
      {expanded && (
        <div className="border-t border-gray-100 overflow-x-auto max-h-60 bg-gray-50/60">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 text-gray-500 sticky top-0">
                <th className="text-left px-4 py-2 font-medium">แถว</th>
                <th className="text-left px-4 py-2 font-medium">Task Name</th>
                <th className="text-left px-4 py-2 font-medium">Assignee</th>
                <th className="text-right px-4 py-2 font-medium">Hours</th>
                <th className="text-left px-4 py-2 font-medium">Deadline</th>
                <th className="text-left px-4 py-2 font-medium">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {session.rows.map(r => {
                const emp = r.assigneeId ? employees.find(e => e.id === r.assigneeId) : null
                return (
                  <tr key={r.rowNo} className={r.error ? 'bg-red-50/70' : ''}>
                    <td className="px-4 py-1.5 text-gray-400 font-mono">{r.rowNo}</td>
                    <td className="px-4 py-1.5 text-gray-800 max-w-[180px] truncate">{r.taskName}</td>
                    <td className="px-4 py-1.5 text-gray-600">
                      {emp ? `${emp.firstName} ${emp.lastName}` : <span className="text-red-400">{r.assigneeRaw ?? '—'}</span>}
                    </td>
                    <td className="px-4 py-1.5 text-right">{r.estimatedHours}h</td>
                    <td className="px-4 py-1.5 text-gray-600">{r.deadline ? formatDate(r.deadline) : '—'}</td>
                    <td className="px-4 py-1.5">
                      {r.error ? <span className="text-red-500">{r.error}</span> : <span className="text-green-600">✓</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
