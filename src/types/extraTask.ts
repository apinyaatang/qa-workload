export const EXTRA_TASK_TYPES = [
  'Issue PRD',
  'Urgent',
  'Improve',
  'Internal Request',
  'Other',
] as const

export type ExtraTaskType = typeof EXTRA_TASK_TYPES[number]

export interface ExtraTask {
  id: string
  tester:          string | null
  projectName:     string
  type:            ExtraTaskType | string
  status:          string
  goLiveDate:      string | null
  testingPercent:  number | null
  testEstimateDay: number | null
  remark:          string | null
  createdAt:       string
  updatedAt:       string
}
