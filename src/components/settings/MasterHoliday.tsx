import { useState } from 'react'
import { Plus, Trash2, X, Check, Calendar } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { formatDate } from '../../utils/dateUtils'

export default function MasterHoliday() {
  const { publicHolidays, addPublicHoliday, removePublicHoliday } = useApp()
  const [form, setForm] = useState({ date: '', name: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const sorted = [...publicHolidays].sort((a, b) => a.date.localeCompare(b.date))

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.date || !form.name) return
    if (publicHolidays.find(h => h.date === form.date)) return
    addPublicHoliday({ id: `ph-${Date.now()}`, date: form.date, name: form.name })
    setForm({ date: '', name: '' })
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-base font-bold text-gray-900">วันหยุดนักขัตฤกษ์</h2>
        <p className="text-sm text-gray-400 mt-0.5">กำหนดปฏิทินวันหยุดที่ใช้คำนวณ Capacity ของพนักงาน</p>

        <form onSubmit={handleAdd} className="mt-4 flex gap-3 flex-wrap">
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" required />
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="ชื่อวันหยุด เช่น วันแรงงาน"
            className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" required />
          <button type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus size={15} /> เพิ่มวันหยุด
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50 bg-gray-50">
          <p className="text-xs text-gray-500 font-medium">รายการวันหยุดทั้งหมด ({publicHolidays.length} วัน)</p>
        </div>
        {sorted.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar size={32} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">ยังไม่มีวันหยุดที่กำหนด</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {sorted.map(h => (
              <div key={h.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-center">
                    <p className="text-xs font-bold text-indigo-600 leading-none">
                      {new Date(h.date).getDate()}<br />
                      <span className="text-[9px] font-normal">{new Date(h.date).toLocaleString('th', { month: 'short' })}</span>
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{h.name}</p>
                    <p className="text-xs text-gray-400">{formatDate(h.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {deleteConfirm === h.id ? (
                    <>
                      <button onClick={() => { removePublicHoliday(h.id); setDeleteConfirm(null) }} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteConfirm(h.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
