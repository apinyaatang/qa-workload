import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { LeaveType } from '../../types'
import { X } from 'lucide-react'

interface Props {
  empId: string
  onClose: () => void
}

export default function AddLeaveModal({ empId, onClose }: Props) {
  const { addLeaveRecord, employees } = useApp()
  const emp = employees.find(e => e.id === empId)
  const [date, setDate] = useState('')
  const [leaveType, setLeaveType] = useState<LeaveType>('annual')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) return
    addLeaveRecord({
      id: `leave-${Date.now()}`,
      employeeId: empId,
      date,
      leaveType,
      status: 'pending',
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">เพิ่มวันลา</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <p className="text-sm text-gray-600 mb-4">สำหรับ: <strong>{emp?.firstName} {emp?.lastName}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">วันที่</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">ประเภทลา</label>
            <select
              value={leaveType}
              onChange={e => setLeaveType(e.target.value as LeaveType)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
            >
              <option value="annual">ลาพักร้อน</option>
              <option value="sick">ลาป่วย</option>
              <option value="personal">ลากิจ</option>
              <option value="maternity">ลาคลอด</option>
              <option value="other">อื่นๆ</option>
            </select>
          </div>
          <p className="text-xs text-gray-400">* วันลาจะถูกเพิ่มในสถานะ "รออนุมัติ" และจะไม่กระทบ Capacity จนกว่าจะอนุมัติ</p>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm">
              ยกเลิก
            </button>
            <button type="submit" className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium">
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
