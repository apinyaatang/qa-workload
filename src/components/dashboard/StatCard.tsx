import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string | number
  sub?: string
  icon: ReactNode
  iconBg: string
  trend?: 'up' | 'down' | 'neutral'
}

export default function StatCard({ label, value, sub, icon, iconBg }: Props) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
