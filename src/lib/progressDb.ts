import { supabase, isConfigured } from './supabase'

export interface ProgressUpdate {
  id?: string
  planningId: string
  staffId: string
  testingPercent: number
  comment: string
  adoSnapshot?: Record<string, number>  // { status: count }
  sentToTeams: boolean
  teamsSentAt?: string
  createdAt?: string
}

function throwIf(error: unknown, ctx: string) {
  if (error) throw new Error(`[progressDb/${ctx}] ${(error as any).message}`)
}

export const progressDb = {
  async insert(update: ProgressUpdate): Promise<void> {
    if (!isConfigured) return
    const { error } = await (supabase as any).from('progress_updates').insert({
      planning_id:     update.planningId,
      staff_id:        update.staffId,
      testing_percent: update.testingPercent,
      comment:         update.comment,
      ado_snapshot:    update.adoSnapshot ?? null,
      sent_to_teams:   update.sentToTeams,
      teams_sent_at:   update.teamsSentAt ?? null,
    })
    throwIf(error, 'insert')
  },

  async getByPlanningId(planningId: string, limit = 5): Promise<ProgressUpdate[]> {
    if (!isConfigured) return []
    const { data, error } = await (supabase as any)
      .from('progress_updates')
      .select('*')
      .eq('planning_id', planningId)
      .order('created_at', { ascending: false })
      .limit(limit)
    throwIf(error, 'getByPlanningId')
    return (data ?? []).map((r: any) => ({
      id:              r.id,
      planningId:      r.planning_id,
      staffId:         r.staff_id,
      testingPercent:  r.testing_percent,
      comment:         r.comment,
      adoSnapshot:     r.ado_snapshot,
      sentToTeams:     r.sent_to_teams,
      teamsSentAt:     r.teams_sent_at,
      createdAt:       r.created_at,
    }))
  },
}
