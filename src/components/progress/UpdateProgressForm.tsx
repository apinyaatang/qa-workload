import { useEffect, useState } from 'react'
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { planningDb } from '../../lib/planningDb'
import { progressDb } from '../../lib/progressDb'
import { sendProgressToTeams } from '../../lib/teamsService'
import type { PlanningProject } from '../../types/planning'
import type { ADOStatusSummary } from '../../lib/adoService'
import ProgressHistory from './ProgressHistory'

interface Props {
  project: PlanningProject
  adoSummary?: ADOStatusSummary[]
}

const TEAMS_WEBHOOK = import.meta.env.VITE_TEAMS_WEBHOOK_URL as string | undefined

function getProgressColor(pct: number): string {
  if (pct >= 100) return 'bg-green-500'
  if (pct >= 71)  return 'bg-blue-500'
  if (pct >= 31)  return 'bg-amber-500'
  return 'bg-red-500'
}

export default function UpdateProgressForm({ project, adoSummary = [] }: Props) {
  const [pct, setPct] = useState(project.testingPercent ?? 0)
  const [comment, setComment] = useState('')
  const [sendTeams, setSendTeams] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [historyKey, setHistoryKey] = useState(0)

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toast])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim()) {
      setToast({ type: 'error', message: 'กรุณากรอก Comment ก่อน Submit' })
      return
    }
    setSubmitting(true)
    try {
      // 1. Update planning_projects.testing_percent
      await planningDb.updateField(project.id, 'testing_percent', pct)

      // 2. Insert progress_updates record
      const adoSnapshot = adoSummary.reduce((acc, s) => {
        acc[s.status] = s.count
        return acc
      }, {} as Record<string, number>)

      const now = new Date().toISOString()
      let sentToTeams = false

      // 3. Send Teams notification if requested
      if (sendTeams && TEAMS_WEBHOOK) {
        await sendProgressToTeams(TEAMS_WEBHOOK, {
          projectName:    project.projectName,
          iteration:      project.iteration,
          tester:         project.tester,
          testingPercent: pct,
          comment:        comment.trim(),
          uatDate:        project.uatDate,
          goLiveDate:     project.goLiveDate,
          adoSummary:     adoSummary,
          updatedBy:      'System',
          updatedAt:      new Date().toLocaleString('th-TH'),
        })
        sentToTeams = true
      }

      await progressDb.insert({
        planningId:     project.id,
        staffId:        'offline',
        testingPercent: pct,
        comment:        comment.trim(),
        adoSnapshot,
        sentToTeams,
        teamsSentAt:    sentToTeams ? now : undefined,
      })

      setToast({ type: 'success', message: `บันทึกสำเร็จ${sentToTeams ? ' · ส่งแจ้งเตือน Teams แล้ว' : ''}` })
      setComment('')
      setSendTeams(false)
      setHistoryKey(k => k + 1)
    } catch (err: any) {
      setToast({ type: 'error', message: err.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm border ${
          toast.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <AlertCircle size={15} className="shrink-0 mt-0.5" />}
          {toast.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Testing % */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-slate-200">Testing Progress</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0} max={100}
                value={pct}
                onChange={e => setPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-16 text-center border border-gray-200 dark:border-slate-600 rounded-lg py-1 text-sm font-bold outline-none focus:border-indigo-400 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200"
              />
              <span className="text-sm text-gray-500 dark:text-slate-400 font-semibold">%</span>
            </div>
          </div>
          <input
            type="range"
            min={0} max={100} step={1}
            value={pct}
            onChange={e => setPct(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-slate-600 accent-indigo-600"
          />
          {/* Preview bar */}
          <div className="mt-2 w-full h-3 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getProgressColor(pct)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5">
            Comment <span className="text-red-500">*</span>
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={4}
            placeholder="สรุปสิ่งที่ทำ ปัญหาที่พบ หรือ next step..."
            className="w-full border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 dark:placeholder-slate-400 resize-none"
          />
        </div>

        {/* Teams checkbox */}
        {TEAMS_WEBHOOK && (
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={sendTeams}
              onChange={e => setSendTeams(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                ส่งแจ้งเตือนไปยัง Microsoft Teams
              </span>
              <p className="text-xs text-gray-400 dark:text-slate-500">จะส่ง Adaptive Card พร้อมรายละเอียดโปรเจค</p>
            </div>
          </label>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {submitting ? 'กำลังบันทึก...' : 'Submit Progress'}
        </button>
      </form>

      {/* History */}
      <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
        <ProgressHistory key={historyKey} planningId={project.id} />
      </div>
    </div>
  )
}
