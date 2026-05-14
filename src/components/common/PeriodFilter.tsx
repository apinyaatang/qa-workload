import { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { getPeriod } from '../../utils/dateUtils'
import type { PeriodType } from '../../types'

export default function PeriodFilter() {
  const { selectedPeriod, setSelectedPeriod } = useApp()
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const ref = new Date('2026-05-07')

  function selectPeriod(type: PeriodType) {
    if (type === 'custom') {
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    setSelectedPeriod(getPeriod(type, ref))
  }

  function applyCustom() {
    if (!customStart || !customEnd) return
    setSelectedPeriod(getPeriod('custom', ref, customStart, customEnd))
    setShowCustom(false)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Calendar size={16} className="text-gray-500" />
      <span className="text-sm text-gray-600 font-medium">Period:</span>

      {(['weekly', 'monthly'] as PeriodType[]).map(t => (
        <button
          key={t}
          onClick={() => selectPeriod(t)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedPeriod.type === t && !showCustom
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          {t === 'weekly' ? 'รายสัปดาห์' : 'รายเดือน'}
        </button>
      ))}

      <button
        onClick={() => selectPeriod('custom')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
          selectedPeriod.type === 'custom'
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
        }`}
      >
        Custom <ChevronDown size={14} />
      </button>

      {showCustom && (
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <input
            type="date"
            value={customStart}
            onChange={e => setCustomStart(e.target.value)}
            className="text-sm border-none outline-none"
          />
          <span className="text-gray-400">–</span>
          <input
            type="date"
            value={customEnd}
            onChange={e => setCustomEnd(e.target.value)}
            className="text-sm border-none outline-none"
          />
          <button
            onClick={applyCustom}
            className="ml-2 px-3 py-1 bg-indigo-600 text-white rounded text-sm font-medium"
          >
            Apply
          </button>
        </div>
      )}

      <span className="text-sm text-indigo-700 font-semibold bg-indigo-50 px-3 py-1.5 rounded-lg">
        {selectedPeriod.label}
      </span>
    </div>
  )
}
