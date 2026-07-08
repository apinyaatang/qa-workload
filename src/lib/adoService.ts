// ⚠️ CORS NOTE: Direct browser → ADO REST API may be blocked by CORS in production.
// For production, proxy this through a Supabase Edge Function or backend API.

export interface ADOWorkItem {
  id: number
  title: string
  state: string
  workItemType: string
  assignedTo: string
  priority: number
  tags: string
  changedDate: string
}

export interface ADOStatusSummary {
  status: string
  count: number
  color: string
}

const ADO_STATUS_COLORS: Record<string, string> = {
  'New':         'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  'Active':      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'In Progress': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  'Resolved':    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  'Closed':      'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  'Blocked':     'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
}

function getAuthHeader(pat: string): string {
  return 'Basic ' + btoa(':' + pat)
}

export function getStatusColor(state: string): string {
  return ADO_STATUS_COLORS[state] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
}

export async function fetchWorkItemsByTag(
  org: string,
  project: string,
  tag: string,
  pat: string,
): Promise<ADOWorkItem[]> {
  const headers = {
    'Authorization': getAuthHeader(pat),
    'Content-Type': 'application/json',
  }

  // Step 1: WIQL query to get IDs
  const wiql = {
    query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [System.Tags] CONTAINS '${tag}' AND [System.State] <> 'Removed' ORDER BY [System.ChangedDate] DESC`
  }

  const wiqlRes = await fetch(
    `${org}/${project}/_apis/wit/wiql?api-version=7.0`,
    { method: 'POST', headers, body: JSON.stringify(wiql) }
  )
  if (!wiqlRes.ok) throw new Error(`ADO WIQL error: ${wiqlRes.status} ${wiqlRes.statusText}`)
  const wiqlData = await wiqlRes.json()

  const ids: number[] = (wiqlData.workItems ?? []).map((w: any) => w.id).slice(0, 200)
  if (ids.length === 0) return []

  // Step 2: Batch fetch work item details
  const fields = [
    'System.Id', 'System.Title', 'System.State', 'System.WorkItemType',
    'System.AssignedTo', 'Microsoft.VSTS.Common.Priority',
    'System.Tags', 'System.ChangedDate',
  ].join(',')

  const detailRes = await fetch(
    `${org}/_apis/wit/workitems?ids=${ids.join(',')}&fields=${fields}&api-version=7.0`,
    { method: 'GET', headers }
  )
  if (!detailRes.ok) throw new Error(`ADO work items error: ${detailRes.status}`)
  const detailData = await detailRes.json()

  return (detailData.value ?? []).map((item: any) => ({
    id: item.id,
    title: item.fields['System.Title'] ?? '',
    state: item.fields['System.State'] ?? '',
    workItemType: item.fields['System.WorkItemType'] ?? '',
    assignedTo: item.fields['System.AssignedTo']?.displayName ?? '—',
    priority: item.fields['Microsoft.VSTS.Common.Priority'] ?? 0,
    tags: item.fields['System.Tags'] ?? '',
    changedDate: item.fields['System.ChangedDate'] ?? '',
  }))
}

export function groupByStatus(items: ADOWorkItem[]): ADOStatusSummary[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    counts.set(item.state, (counts.get(item.state) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({ status, count, color: getStatusColor(status) }))
}
