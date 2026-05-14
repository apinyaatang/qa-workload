import { useState } from 'react'
import { Plus, Pencil, Trash2, Search, X, Check } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { Project, ProjectStatus } from '../../types'
import { formatDate } from '../../utils/dateUtils'

const statusColors: Record<ProjectStatus, string> = {
  Active:    'bg-green-100 text-green-700',
  Inactive:  'bg-gray-100 text-gray-500',
  Completed: 'bg-blue-100 text-blue-700',
}

const DEPARTMENTS = ['Engineering', 'Design', 'Product', 'Marketing', 'QA', 'DevOps', 'Finance', 'HR']
const STATUSES: ProjectStatus[] = ['Active', 'Inactive', 'Completed']

function emptyProject(): Omit<Project, 'id' | 'createdAt'> {
  return {
    code: '', name: '', description: '',
    department: 'Engineering', ownerId: '',
    startDate: '', endDate: '', status: 'Active',
  }
}

export default function MasterProject() {
  const { projects, employees, addProject, updateProject, deleteProject } = useApp()
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<string | null>(null)   // null = new
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyProject())
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.department.toLowerCase().includes(q)
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchQ && matchStatus
  })

  function openNew() {
    setForm(emptyProject())
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(p: Project) {
    setForm({
      code: p.code, name: p.name, description: p.description ?? '',
      department: p.department, ownerId: p.ownerId,
      startDate: p.startDate, endDate: p.endDate ?? '',
      status: p.status, budget: p.budget,
    })
    setEditId(p.id)
    setShowForm(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code || !form.name || !form.startDate) return
    if (editId) {
      updateProject({ ...form, id: editId, createdAt: projects.find(p => p.id === editId)!.createdAt })
    } else {
      addProject({ ...form, id: `proj-${Date.now()}`, createdAt: new Date().toISOString().slice(0, 10) })
    }
    setShowForm(false)
  }

  function handleDelete(id: string) {
    deleteProject(id)
    setDeleteConfirm(null)
  }

  const activeEmployees = employees.filter(e => e.isActive)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-gray-900">Master Project</h2>
            <p className="text-sm text-gray-400 mt-0.5">จัดการข้อมูล Project ทั้งหมด ({projects.length} รายการ)</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> เพิ่ม Project
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหา Project..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          >
            <option value="all">ทุก Status</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium">รหัส / ชื่อ Project</th>
                <th className="text-left px-4 py-3 font-medium">แผนก</th>
                <th className="text-left px-4 py-3 font-medium">Owner</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">วันที่เริ่ม</th>
                <th className="text-left px-4 py-3 font-medium">วันสิ้นสุด</th>
                <th className="text-right px-4 py-3 font-medium">งบประมาณ</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => {
                const owner = employees.find(e => e.id === p.ownerId)
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-900">{p.name}</p>
                      <p className="text-xs text-indigo-600 font-mono mt-0.5">{p.code}</p>
                      {p.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.department}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {owner ? `${owner.firstName} ${owner.lastName}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(p.startDate)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.endDate ? formatDate(p.endDate) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {p.budget != null ? p.budget.toLocaleString() : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        {deleteConfirm === p.id ? (
                          <span className="flex items-center gap-1">
                            <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                              <X size={14} />
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(p.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">ไม่พบข้อมูล Project</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{editId ? 'แก้ไข Project' : 'เพิ่ม Project ใหม่'}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="รหัส Project *" required>
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    placeholder="PRJ-2026-XXX" className={inputCls} required />
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectStatus }))} className={inputCls}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="ชื่อ Project *" required>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ชื่อ Project" className={inputCls} required />
              </Field>

              <Field label="รายละเอียด">
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="คำอธิบาย Project" className={inputCls + ' resize-none'} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="แผนก">
                  <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className={inputCls}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Project Owner">
                  <select value={form.ownerId} onChange={e => setForm(f => ({ ...f, ownerId: e.target.value }))} className={inputCls}>
                    <option value="">— เลือก Owner —</option>
                    {activeEmployees.map(e => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Field label="วันเริ่มต้น *" required>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className={inputCls} required />
                </Field>
                <Field label="วันสิ้นสุด">
                  <input type="date" value={form.endDate ?? ''} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className={inputCls} />
                </Field>
                <Field label="งบประมาณ (บาท)">
                  <input type="number" value={form.budget ?? ''} onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) || undefined }))}
                    placeholder="0" className={inputCls} />
                </Field>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50">
                  ยกเลิก
                </button>
                <button type="submit"
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700">
                  {editId ? 'บันทึกการแก้ไข' : 'เพิ่ม Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100'

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
