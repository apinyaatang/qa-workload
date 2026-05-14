import type { WorkloadStatus } from '../../types'

interface Props {
  status: WorkloadStatus
  pct?: number
  size?: 'sm' | 'md'
}

const config: Record<WorkloadStatus, { bg: string; text: string; dot: string; label: string }> = {
  Overloaded:    { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Overloaded' },
  'High Load':   { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', label: 'High Load' },
  Normal:        { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500',  label: 'Normal' },
  Underutilized: { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500',   label: 'Underutilized' },
  Idle:          { bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400',   label: 'Idle' },
}

export default function WorkloadBadge({ status, pct, size = 'md' }: Props) {
  const c = config[status]
  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${c.bg} ${c.text} ${px}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      {c.label}{pct !== undefined ? ` (${pct}%)` : ''}
    </span>
  )
}
