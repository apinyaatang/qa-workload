export interface TeamsProgressPayload {
  projectName: string
  iteration: string
  tester: string
  testingPercent: number
  comment: string
  uatDate: string | null
  goLiveDate: string | null
  adoSummary: { status: string; count: number }[]
  updatedBy: string
  updatedAt: string
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function buildAdaptiveCard(payload: TeamsProgressPayload): object {
  const adoFacts = payload.adoSummary.map(s => ({
    title: s.status,
    value: String(s.count),
  }))

  return {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          {
            type: 'TextBlock',
            text: '🧪 Testing Progress Update',
            weight: 'Bolder',
            size: 'Large',
            color: 'Accent',
          },
          {
            type: 'FactSet',
            facts: [
              { title: 'Project',    value: payload.projectName },
              { title: 'Iteration',  value: payload.iteration },
              { title: 'Tester',     value: payload.tester },
              { title: 'Testing %',  value: `${payload.testingPercent}%` },
              { title: 'UAT Date',   value: formatDate(payload.uatDate) },
              { title: 'Go Live',    value: formatDate(payload.goLiveDate) },
              { title: 'Updated by', value: payload.updatedBy },
              { title: 'Updated at', value: payload.updatedAt },
            ],
          },
          {
            type: 'TextBlock',
            text: '📋 Comment',
            weight: 'Bolder',
            spacing: 'Medium',
          },
          {
            type: 'TextBlock',
            text: payload.comment || '(ไม่มี comment)',
            wrap: true,
          },
          ...(payload.adoSummary.length > 0 ? [
            {
              type: 'TextBlock',
              text: '📊 ADO Work Items Status',
              weight: 'Bolder',
              spacing: 'Medium',
            },
            {
              type: 'FactSet',
              facts: adoFacts,
            },
          ] : []),
        ],
      },
    }],
  }
}

export async function sendProgressToTeams(
  webhookUrl: string,
  payload: TeamsProgressPayload,
): Promise<void> {
  const card = buildAdaptiveCard(payload)
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  })
  if (!res.ok) {
    throw new Error(`Teams webhook error: ${res.status} ${res.statusText}`)
  }
}
