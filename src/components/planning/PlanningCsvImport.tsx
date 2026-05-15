import React, { useState, useRef, useCallback, useMemo } from 'react'
import {
  Upload, AlertCircle, CheckCircle2, ChevronLeft,
  Download, Loader2,
} from 'lucide-react'
import type {
  PlanningCsvRow,
  PlanningImportResult,
  PlanningProject,
} from '../../types/planning'
import { parsePlanningCsv } from '../../utils/planningCsvParser'
import { planningDb } from '../../lib/planningDb'
import { useApp } from '../../context/AppContext'

interface Props {
  existingIds: Set<string>
  onImportComplete: (result: PlanningImportResult) => void
  onPreviewReady: (rows: PlanningCsvRow[]) => void
}

type Step = 'upload' | 'preview' | 'result'

const PRIORITY_BADGE: Record<string, string> = {
  Critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  High: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  Medium: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
  Low: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  '': 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400',
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── CSV template content ────────────────────────────────────────────────────────
const TEMPLATE_HEADERS =
  'ID,Iteration,Project Name,Item Type,Feature,Tags,Status,Test Buddy,Priority,Tester,Go Live Date,UAT Date,Testing (%),Tester Flag,Tester Note,Test Estimate (Day),Remark to PMOs,PM,BA Note,Quotation No.,Epic No.'

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_HEADERS + '\n'], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'planning_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PlanningCsvImport({ existingIds, onImportComplete, onPreviewReady }: Props) {
  const { publicHolidays } = useApp()
  const holidaySet = useMemo(
    () => new Set(publicHolidays.map(h => h.date)),
    [publicHolidays],
  )

  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [rows, setRows] = useState<PlanningCsvRow[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<PlanningImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── File processing ──────────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Only .csv files are accepted.')
      return
    }

    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const parsed = parsePlanningCsv(text, { holidays: holidaySet })

      if (parsed.parseError) {
        setParseError(parsed.parseError)
        return
      }

      // Mark willUpdate based on existingIds
      const marked = parsed.rows.map(row => ({
        ...row,
        willUpdate: row.data.id ? existingIds.has(row.data.id) : false,
      }))

      setRows(marked)
      onPreviewReady(marked)
      setParseError(null)
      setStep('preview')
    }
    reader.readAsText(file)
  }, [existingIds, holidaySet, onPreviewReady])

  // ── Drag & drop handlers ─────────────────────────────────────────────────────

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }
  const onDragLeave = () => setDragging(false)

  // ── Import ───────────────────────────────────────────────────────────────────

  async function handleImport() {
    const validRows = rows.filter(r => r.isValid)
    if (validRows.length === 0) return

    setImporting(true)
    try {
      const projects = validRows.map(r => r.data as PlanningProject)
      const res = await planningDb.upsertMany(projects)
      setResult(res)
      onImportComplete(res)
      setStep('result')
    } catch (err: any) {
      setParseError(err.message ?? 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  // ── Computed counts ──────────────────────────────────────────────────────────

  const validRows = rows.filter(r => r.isValid)
  const errorRows = rows.filter(r => !r.isValid)
  const newRows = validRows.filter(r => !r.willUpdate)
  const updateRows = validRows.filter(r => r.willUpdate)

  // ── Step indicators ──────────────────────────────────────────────────────────

  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: '1. Upload' },
    { key: 'preview', label: '2. Preview' },
    { key: 'result', label: '3. Result' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div
              className={`px-4 py-1.5 rounded text-xs font-semibold ${
                step === s.key
                  ? 'bg-blue-600 text-white'
                  : steps.findIndex(x => x.key === step) > i
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
              }`}
            >
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <div className="w-8 h-0.5 bg-gray-200 dark:bg-slate-600" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── STEP 1: Upload ──────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="flex flex-col gap-4">
          {/* Drop zone */}
          <div
            className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-14 px-8 cursor-pointer transition-colors ${
              dragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 hover:border-blue-400 hover:bg-blue-50/30'
            }`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload
              size={36}
              className={`${dragging ? 'text-blue-500' : 'text-gray-400 dark:text-slate-500'}`}
            />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
                Drag & drop a CSV file here, or{' '}
                <span className="text-blue-600 underline">browse</span>
              </p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Accepts .csv files only</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) processFile(file)
                e.target.value = ''
              }}
            />
          </div>

          {/* Download template */}
          <button
            onClick={e => { e.stopPropagation(); downloadTemplate() }}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 underline w-fit"
          >
            <Download size={14} />
            Download CSV Template
          </button>

          {/* Parse error */}
          {parseError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Preview ─────────────────────────────────────────────────── */}
      {step === 'preview' && (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200">
              Total: <strong>{rows.length}</strong>
            </span>
            <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300">
              Valid: <strong>{validRows.length}</strong>
            </span>
            {errorRows.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                Errors: <strong>{errorRows.length}</strong>
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              New: <strong>{newRows.length}</strong>
            </span>
            {updateRows.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                Update: <strong>{updateRows.length}</strong>
              </span>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-600 shadow-sm">
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap border-b dark:border-slate-600">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap border-b dark:border-slate-600">Row</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap border-b dark:border-slate-600">ID</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide border-b dark:border-slate-600">Project Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap border-b dark:border-slate-600">UAT Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap border-b dark:border-slate-600">Est. (day)</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap border-b dark:border-slate-600">Test Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap border-b dark:border-slate-600">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap border-b dark:border-slate-600">Tester</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap border-b dark:border-slate-600">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {rows.map(row => (
                  <tr
                    key={row.rowNo}
                    className={`${
                      !row.isValid
                        ? 'bg-red-50 dark:bg-red-900/20'
                        : row.willUpdate
                        ? 'bg-amber-50/40 dark:bg-amber-900/20'
                        : 'bg-white dark:bg-slate-800'
                    } hover:bg-blue-50/30 dark:hover:bg-slate-700/50 transition-colors`}
                  >
                    {/* Badge: NEW / UPDATE / ERROR */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {!row.isValid ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold">
                          ERROR
                        </span>
                      ) : row.willUpdate ? (
                        <span className="inline-block px-2 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold">
                          UPDATE
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded bg-green-500 text-white text-[10px] font-bold">
                          NEW
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-400 dark:text-slate-500">{row.rowNo}</td>
                    <td className="px-3 py-2 font-mono text-gray-700 dark:text-slate-200 whitespace-nowrap">{row.data.id || '—'}</td>
                    <td className="px-3 py-2 max-w-[200px]">
                      <div className="truncate text-gray-700 dark:text-slate-200" title={row.data.projectName}>{row.data.projectName || '—'}</div>
                      {!row.isValid && (
                        <div className="text-red-600 dark:text-red-300 text-[10px] mt-0.5">
                          {row.errors.join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-slate-200">{formatDate(row.data.uatDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-center text-gray-700 dark:text-slate-200">
                      {row.data.testEstimateDay != null ? `${row.data.testEstimateDay}d` : '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-slate-200">{formatDate(row.data.testDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-slate-200">{row.data.status || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-slate-200">{row.data.tester || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.data.priority ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            PRIORITY_BADGE[row.data.priority] ?? PRIORITY_BADGE['']
                          }`}
                        >
                          {row.data.priority}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => setStep('upload')}
              className="flex items-center gap-1.5 px-4 py-2 rounded border border-gray-300 dark:border-slate-600 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={validRows.length === 0 || importing}
              className="flex items-center gap-2 px-5 py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing && <Loader2 size={15} className="animate-spin" />}
              Confirm Import ({validRows.length} rows)
            </button>
            {errorRows.length > 0 && (
              <span className="text-xs text-amber-600 dark:text-amber-300">
                {errorRows.length} row{errorRows.length > 1 ? 's' : ''} with errors will be skipped.
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 3: Result ──────────────────────────────────────────────────── */}
      {step === 'result' && result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle2 size={20} className="shrink-0" />
            <span className="font-semibold text-base">Import Complete</span>
          </div>

          {/* Summary card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: result.totalRows, color: 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200' },
              { label: 'Inserted', value: result.insertedRows, color: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300' },
              { label: 'Updated', value: result.updatedRows, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
              { label: 'Failed', value: result.failedRows, color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
            ].map(item => (
              <div key={item.label} className={`rounded-lg p-4 text-center ${item.color}`}>
                <div className="text-2xl font-bold">{item.value}</div>
                <div className="text-xs font-medium mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Error list */}
          {result.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm font-semibold mb-2">
                <AlertCircle size={14} />
                Failed Rows
              </div>
              <ul className="space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-600 dark:text-red-300 flex gap-2">
                    <span className="font-mono shrink-0">Row {err.rowNo} [{err.id}]</span>
                    <span>— {err.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => {
              setStep('upload')
              setRows([])
              setResult(null)
              setParseError(null)
            }}
            className="w-fit flex items-center gap-1.5 px-4 py-2 rounded border border-gray-300 dark:border-slate-600 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
          >
            <Upload size={14} />
            Import Another File
          </button>
        </div>
      )}
    </div>
  )
}
