import { useState, useRef } from 'react'
import { Plus, Pencil, Trash2, Search, X, Check, User, ChevronDown, ChevronUp, Upload, CheckCircle2, AlertCircle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { Employee, LeaveType } from '../../types'
import { formatDate } from '../../utils/dateUtils'
import { parseStaffCsv, type StaffCsvRow } from '../../utils/staffCsvParser'

const DEPARTMENTS = ['Design', 'BA', 'Dev', 'QA']
const POSITIONS = [
  'Design',
  'BA Manager', 'BA Lead', 'Senior BA',
  'Senior Dev', 'Junior Dev',
  'QA Manager', 'QA Lead', 'Senior QA', 'QA',
]
const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'annual',    label: 'ลาพักร้อน' },
  { value: 'sick',      label: 'ลาป่วย' },
  { value: 'personal',  label: 'ลากิจ' },
  { value: 'maternity', label: 'ลาคลอด' },
  { value: 'other',     label: 'อื่นๆ' },
]

const inputCls = 'w-full border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 dark:placeholder-slate-400 disabled:bg-gray-50 disabled:dark:bg-slate-800 disabled:text-gray-400 disabled:dark:text-slate-500 disabled:cursor-not-allowed'

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function emptyEmp(): Omit<Employee, 'id'> & { employeeCode: string } {
  return {
    employeeCode: '',
    firstName: '', lastName: '', nickname: '', team: '',
    department: 'QA', position: 'QA',
    skills: [], startDate: '', isActive: true,
  }
}

export default function MasterStaff() {
  const { employees, leaveRecords, addEmployee, updateEmployee, deleteEmployee, addLeaveRecord, updateLeaveStatus } = useApp()
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('all')
  const [filterActive, setFilterActive] = useState<string>('all')
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyEmp())
  const [formError, setFormError] = useState<string | null>(null)
  const [skillInput, setSkillInput] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [expandedLeave, setExpandedLeave] = useState<string | null>(null)
  const [leaveForm, setLeaveForm] = useState<{ date: string; type: LeaveType }>({ date: '', type: 'annual' })
  // Import staff state
  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState<StaffCsvRow[]>([])
  const [importParseError, setImportParseError] = useState<string | null>(null)
  const [importDone, setImportDone] = useState<{ inserted: number; updated: number } | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    const matchQ = !q || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || e.position.toLowerCase().includes(q)
    const matchDept = filterDept === 'all' || e.department === filterDept
    const matchActive = filterActive === 'all' || (filterActive === 'active' ? e.isActive : !e.isActive)
    return matchQ && matchDept && matchActive
  })

  function openNew() {
    setForm(emptyEmp())
    setSkillInput('')
    setFormError(null)
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(emp: Employee) {
    setForm({
      employeeCode: emp.employeeCode ?? emp.id,
      firstName: emp.firstName, lastName: emp.lastName,
      nickname: emp.nickname ?? '', team: emp.team ?? '',
      department: emp.department, position: emp.position,
      skills: [...emp.skills], startDate: emp.startDate, isActive: emp.isActive,
    })
    setSkillInput('')
    setFormError(null)
    setEditId(emp.id)
    setShowForm(true)
  }

  function addSkill() {
    const s = skillInput.trim()
    if (s && !form.skills.includes(s)) setForm(f => ({ ...f, skills: [...f.skills, s] }))
    setSkillInput('')
  }

  function removeSkill(s: string) { setForm(f => ({ ...f, skills: f.skills.filter(x => x !== s) })) }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const empCode = (form.employeeCode as string)?.trim()

    // Validate Employee ID
    if (!empCode) {
      setFormError('กรุณากรอก Employee ID')
      return
    }

    // Uniqueness check: ID must not exist in other employees
    const isDuplicate = employees.some(emp => {
      if (editId && emp.id === editId) return false  // skip self when editing
      return emp.id === empCode || emp.employeeCode === empCode
    })
    if (isDuplicate) {
      setFormError(`Employee ID "${empCode}" มีอยู่แล้วในระบบ กรุณาใช้ ID อื่น`)
      return
    }

    const payload = {
      ...form,
      employeeCode: empCode,
      nickname: (form.nickname as string)?.trim() || undefined,
      team:     (form.team as string)?.trim()     || undefined,
    }
    if (editId) {
      updateEmployee({ ...payload, id: editId })
    } else {
      addEmployee({ ...payload, id: empCode })
    }
    setShowForm(false)
  }

  function addLeave(empId: string) {
    if (!leaveForm.date) return
    addLeaveRecord({ id: `leave-${Date.now()}`, employeeId: empId, date: leaveForm.date, leaveType: leaveForm.type, status: 'pending' })
    setLeaveForm({ date: '', type: 'annual' })
  }

  const depts = [...new Set(employees.map(e => e.department))]

  // ── Import staff handlers ────────────────────────────────────────────────────
  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const existingIds = new Set(employees.map(emp => emp.id))
      const result = parseStaffCsv(text, existingIds)
      if (result.parseError) {
        setImportParseError(result.parseError)
        setImportRows([])
      } else {
        setImportParseError(null)
        setImportRows(result.rows)
        setImportDone(null)
      }
      setShowImport(true)
    }
    reader.readAsText(file, 'utf-8')
  }

  function handleConfirmImport() {
    let inserted = 0, updated = 0
    for (const row of importRows.filter(r => r.isValid)) {
      if (row.willUpdate) { updateEmployee(row.data); updated++ }
      else                { addEmployee(row.data);    inserted++ }
    }
    setImportDone({ inserted, updated })
    setImportRows([])
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Master Staff</h2>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-0.5">จัดการข้อมูลพนักงาน ({employees.length} คน)</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Import CSV button */}
            <label className="flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer">
              <Upload size={16} /> Import Staff
              <input
                ref={importFileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImportFile}
              />
            </label>
            <button onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              <Plus size={16} /> เพิ่มพนักงาน
            </button>
          </div>
        </div>
        <div className="mt-4 flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ, ตำแหน่ง..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-400 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 dark:placeholder-slate-400" />
          </div>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200">
            <option value="all">ทุกแผนก</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterActive} onChange={e => setFilterActive(e.target.value)} className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200">
            <option value="all">ทุกสถานะ</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400 text-xs border-b border-gray-100 dark:border-slate-700">
                <th className="text-left px-5 py-3 font-medium">พนักงาน / ชื่อเล่น</th>
                <th className="text-left px-4 py-3 font-medium">แผนก / ตำแหน่ง</th>
                <th className="text-left px-4 py-3 font-medium">Team</th>
                <th className="text-left px-4 py-3 font-medium">Skills</th>
                <th className="text-left px-4 py-3 font-medium">วันเริ่มงาน</th>
                <th className="text-left px-4 py-3 font-medium">สถานะ</th>
                <th className="text-left px-4 py-3 font-medium">วันลา</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
              {filtered.map(emp => {
                const empLeaves = leaveRecords.filter(l => l.employeeId === emp.id)
                const approvedCount = empLeaves.filter(l => l.status === 'approved').length
                const pendingCount = empLeaves.filter(l => l.status === 'pending').length
                const isExpanded = expandedLeave === emp.id

                return (
                  <>
                    <tr key={emp.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/40 rounded-full flex items-center justify-center shrink-0">
                            <User size={15} className="text-indigo-500 dark:text-indigo-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {emp.firstName} {emp.lastName}
                              {emp.nickname && <span className="ml-1 text-xs text-indigo-500 dark:text-indigo-400 font-medium">({emp.nickname})</span>}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-slate-500 font-mono">{emp.employeeCode ?? emp.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700 dark:text-slate-200 font-medium">{emp.department}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{emp.position}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300 text-xs">
                        {emp.team || <span className="text-gray-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {emp.skills.slice(0, 3).map(s => (
                            <span key={s} className="text-xs bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-600">{s}</span>
                          ))}
                          {emp.skills.length > 3 && <span className="text-xs text-gray-400 dark:text-slate-500">+{emp.skills.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-300">{formatDate(emp.startDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${emp.isActive ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                          {emp.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedLeave(isExpanded ? null : emp.id)}
                          className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          <span className="font-medium">{approvedCount} วัน</span>
                          {pendingCount > 0 && <span className="text-orange-500">+{pendingCount} รออนุมัติ</span>}
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(emp)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded">
                            <Pencil size={14} />
                          </button>
                          {deleteConfirm === emp.id ? (
                            <span className="flex items-center gap-1">
                              <button onClick={() => { deleteEmployee(emp.id); setDeleteConfirm(null) }} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                                <Check size={14} />
                              </button>
                              <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-600 rounded">
                                <X size={14} />
                              </button>
                            </span>
                          ) : (
                            <button onClick={() => setDeleteConfirm(emp.id)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Leave sub-panel */}
                    {isExpanded && (
                      <tr key={emp.id + '-leave'}>
                        <td colSpan={7} className="bg-gray-50/80 dark:bg-slate-700/50 px-5 py-4 border-t border-gray-100 dark:border-slate-700">
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-gray-600 dark:text-slate-300">บันทึกวันลา — {emp.firstName} {emp.lastName}</p>

                            {/* Add leave */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <input type="date" value={leaveForm.date} onChange={e => setLeaveForm(f => ({ ...f, date: e.target.value }))}
                                className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200" />
                              <select value={leaveForm.type} onChange={e => setLeaveForm(f => ({ ...f, type: e.target.value as LeaveType }))}
                                className="border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm outline-none bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200">
                                {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                              <button onClick={() => addLeave(emp.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">
                                <Plus size={12} /> เพิ่มวันลา
                              </button>
                            </div>

                            {/* Leave records */}
                            {empLeaves.length > 0 ? (
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {empLeaves.map(l => (
                                  <div key={l.id} className="flex items-center justify-between bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm text-gray-700 dark:text-slate-200 font-medium">{formatDate(l.date)}</span>
                                      <span className="text-xs text-gray-500 dark:text-slate-400">{LEAVE_TYPES.find(t => t.value === l.leaveType)?.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        l.status === 'approved' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                        : l.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300'
                                        : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                                      }`}>
                                        {l.status === 'approved' ? 'อนุมัติ' : l.status === 'rejected' ? 'ไม่อนุมัติ' : 'รออนุมัติ'}
                                      </span>
                                      {l.status === 'pending' && (
                                        <span className="flex items-center gap-1">
                                          <button onClick={() => updateLeaveStatus(l.id, 'approved')} className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded text-xs" title="อนุมัติ">
                                            <Check size={12} />
                                          </button>
                                          <button onClick={() => updateLeaveStatus(l.id, 'rejected')} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-xs" title="ไม่อนุมัติ">
                                            <X size={12} />
                                          </button>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 dark:text-slate-500">ยังไม่มีการบันทึกวันลา</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400 dark:text-slate-500">ไม่พบข้อมูลพนักงาน</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 shrink-0">
              <h3 className="font-bold text-gray-900 dark:text-white">{editId ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400 dark:text-slate-500" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">

              {/* Employee ID */}
              <Field label="Employee ID *" required>
                <input
                  value={(form as any).employeeCode ?? ''}
                  onChange={e => { setForm(f => ({ ...f, employeeCode: e.target.value })); setFormError(null) }}
                  placeholder="เช่น E001, QA-012"
                  className={inputCls}
                  disabled={!!editId}
                  title={editId ? 'ไม่สามารถแก้ไข Employee ID ได้หลังสร้างแล้ว' : ''}
                />
                {editId && (
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">Employee ID ไม่สามารถแก้ไขได้หลังจากสร้างแล้ว</p>
                )}
              </Field>

              {/* Error message */}
              {formError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  <AlertCircle size={15} className="shrink-0" />
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="ชื่อ *" required>
                  <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    placeholder="ชื่อ" className={inputCls} required />
                </Field>
                <Field label="นามสกุล *" required>
                  <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    placeholder="นามสกุล" className={inputCls} required />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="ชื่อเล่น (Nickname)">
                  <input value={(form as any).nickname ?? ''} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
                    placeholder="เช่น Mameaw, Ant, Koi" className={inputCls} />
                </Field>
                <Field label="Team">
                  <input value={(form as any).team ?? ''} onChange={e => setForm(f => ({ ...f, team: e.target.value }))}
                    placeholder="เช่น QA Team A, Dev Team 1" className={inputCls} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="แผนก">
                  <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className={inputCls}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="ตำแหน่ง">
                  <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className={inputCls}>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="วันเริ่มงาน *" required>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className={inputCls} required />
                </Field>
                <Field label="สถานะ">
                  <select value={form.isActive ? 'active' : 'inactive'} onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'active' }))} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Field>
              </div>

              <Field label="Skills">
                <div className="flex gap-2 mb-2">
                  <input value={skillInput} onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
                    placeholder="พิมพ์ skill แล้วกด Enter" className={inputCls + ' flex-1'} />
                  <button type="button" onClick={addSkill}
                    className="px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-slate-600">
                    เพิ่ม
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.skills.map(s => (
                    <span key={s} className="flex items-center gap-1 text-xs bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full">
                      {s}
                      <button type="button" onClick={() => removeSkill(s)}><X size={10} /></button>
                    </span>
                  ))}
                </div>
              </Field>

              <div className="flex gap-3 pt-2 shrink-0">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700">
                  ยกเลิก
                </button>
                <button type="submit"
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700">
                  {editId ? 'บันทึกการแก้ไข' : 'เพิ่มพนักงาน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Import Staff Modal ── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 pt-12 px-4 pb-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-gray-900 dark:text-white">Import Staff จาก CSV</h3>
              <button onClick={() => { setShowImport(false); setImportDone(null); setImportRows([]) }}>
                <X size={18} className="text-gray-400 dark:text-slate-500" />
              </button>
            </div>

            <div className="p-6">
              {/* Parse error */}
              {importParseError && (
                <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" /> {importParseError}
                </div>
              )}

              {/* Import result summary */}
              {importDone ? (
                <div className="text-center py-8 space-y-3">
                  <CheckCircle2 size={40} className="mx-auto text-green-500" />
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">Import สำเร็จ</p>
                  <div className="flex justify-center gap-6 text-sm text-gray-600 dark:text-slate-300">
                    <span className="flex flex-col items-center">
                      <span className="text-2xl font-bold text-green-600 dark:text-green-300">{importDone.inserted}</span>
                      เพิ่มใหม่
                    </span>
                    <span className="flex flex-col items-center">
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-300">{importDone.updated}</span>
                      อัปเดต
                    </span>
                  </div>
                  <button
                    onClick={() => { setShowImport(false); setImportDone(null) }}
                    className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    ปิด
                  </button>
                </div>
              ) : importRows.length > 0 ? (
                <>
                  {/* Summary */}
                  <div className="flex gap-4 mb-4 text-sm flex-wrap">
                    <span className="px-3 py-1 bg-gray-100 dark:bg-slate-700 rounded-full text-gray-600 dark:text-slate-300">
                      ทั้งหมด {importRows.length} แถว
                    </span>
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/20 rounded-full text-green-700 dark:text-green-300">
                      ✓ ผ่าน {importRows.filter(r => r.isValid).length}
                    </span>
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-700 dark:text-blue-300">
                      อัปเดต {importRows.filter(r => r.isValid && r.willUpdate).length}
                    </span>
                    <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-full text-red-700 dark:text-red-300">
                      ✗ ผิดพลาด {importRows.filter(r => !r.isValid).length}
                    </span>
                  </div>

                  {/* Preview table */}
                  <div className="overflow-x-auto max-h-80 rounded-lg border border-gray-100 dark:border-slate-700">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400 sticky top-0">
                          <th className="text-left px-3 py-2 font-medium">ID</th>
                          <th className="text-left px-3 py-2 font-medium">ชื่อ</th>
                          <th className="text-left px-3 py-2 font-medium">Nick</th>
                          <th className="text-left px-3 py-2 font-medium">ตำแหน่ง</th>
                          <th className="text-left px-3 py-2 font-medium">Group</th>
                          <th className="text-left px-3 py-2 font-medium">สถานะ</th>
                          <th className="text-left px-3 py-2 font-medium">Action</th>
                          <th className="text-left px-3 py-2 font-medium">หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                        {importRows.map(row => (
                          <tr key={row.rowNo} className={row.isValid ? '' : 'bg-red-50 dark:bg-red-900/20'}>
                            <td className="px-3 py-1.5 font-mono text-gray-500 dark:text-slate-400">{row.data.employeeCode}</td>
                            <td className="px-3 py-1.5 font-medium text-gray-900 dark:text-white">
                              {row.data.firstName} {row.data.lastName}
                            </td>
                            <td className="px-3 py-1.5 text-gray-500 dark:text-slate-400">{row.data.nickname}</td>
                            <td className="px-3 py-1.5 text-gray-600 dark:text-slate-300">{row.data.position}</td>
                            <td className="px-3 py-1.5 text-gray-600 dark:text-slate-300">{row.data.group}</td>
                            <td className="px-3 py-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${row.data.isActive ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                                {row.data.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">
                              {row.isValid ? (
                                <span className={`text-[10px] font-medium ${row.willUpdate ? 'text-blue-600 dark:text-blue-300' : 'text-green-600 dark:text-green-300'}`}>
                                  {row.willUpdate ? 'Update' : 'New'}
                                </span>
                              ) : (
                                <span className="text-[10px] text-red-500">Error</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-red-500 max-w-[160px] truncate">
                              {row.errors.join(', ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => { setShowImport(false); setImportRows([]) }}
                      className="flex-1 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={importRows.filter(r => r.isValid).length === 0}
                      className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
                    >
                      ยืนยัน Import ({importRows.filter(r => r.isValid).length} รายการ)
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">เลือกไฟล์ CSV เพื่อ preview ข้อมูล</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
