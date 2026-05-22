import { useEffect, useState } from 'react'
import { History, Loader2, Send } from 'lucide-react'
import { progressDb, type ProgressUpdate } from '../../lib/progressDb'

interface Props {
  planningId: string
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function ProgressHistory({ planningId }: Props) {
  const [history, setHistory] = useState<ProgressUpdate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    progressDb.getByPlanningId(planningId).then(data => {
      setHistory(data)
      setLoading(false)
    })
  }, [planningId])

  if (loading) return (
    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-slate-500 py-4">
      <Loader2 size={13} className="animate-spin" /> กำลังโหลดประวัติ...
    </div>
  )
  if (history.length === 0) return (
    <p className="text-xs text-gray-400 dark:text-slate-500 py-4">ยังไม่มีประวัติการอัพเดท</p>
  )

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-600 dark:text-slate-300 flex items-center gap-1.5">
        <History size={13} /> ประวัติการอัพเดท (5 ล่าสุด)
      </h4>
      {history.map((h, i) => (
        <div key={h.id ?? i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-700">
          <div className="shrink-0 mt-0.5">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
              h.testingPercent >= 100 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
              h.testingPercent >= 71  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
              h.testingPercent >= 31  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                                        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}>
              {h.testingPercent}%
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500 dark:text-slate-400">{formatDateTime(h.createdAt)}</span>
              {h.sentToTeams && (
                <span className="flex items-center gap-0.5 text-[10px] text-indigo-500 dark:text-indigo-400">
                  <Send size={10} /> Teams
                </span>
              )}
            </div>
            {h.comment && (
              <p className="text-xs text-gray-700 dark:text-slate-200 mt-0.5 line-clamp-2">{h.comment}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
