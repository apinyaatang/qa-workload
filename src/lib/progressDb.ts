import { supabase, isConfigured } from './supabase'

export interface ProgressUpdate {
  id?: string
  planningId: string
  /**
   * user id จริงจาก auth.users — null เมื่อยังไม่เปิด login
   *
   * เดิมเป็น `string` และถูกส่งค่า 'offline' เข้ามา ซึ่งใส่ลงคอลัมน์
   * uuid REFERENCES auth.users(id) ไม่ได้เลย — insert ล้มทุกครั้ง
   */
  staffId: string | null
  /**
   * ชื่อคนที่บันทึก เก็บซ้ำไว้ในแถวโดยเจตนา
   *
   * ตารางนี้เป็น log แบบเขียนต่อท้ายอย่างเดียว ชื่อที่ต้องการคือชื่อ
   * ณ เวลาที่บันทึก และต้องอ่านได้ต่อไปแม้ staff_id จะกลายเป็น NULL
   * ตอน user ถูกลบ (ON DELETE SET NULL)
   */
  staffName?: string | null
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
  /**
   * บันทึกประวัติ 1 แถว
   *
   * ต้องมี staffId จริงเท่านั้น — policy "progress_updates: own insert"
   * บังคับ staff_id = auth.uid() ผู้เรียกต้องเช็ค canRecord จาก
   * attributionFor() ก่อน ไม่ใช่เรียกแล้วรอ error
   */
  async insert(update: ProgressUpdate): Promise<void> {
    if (!isConfigured) return
    if (!update.staffId) {
      throw new Error('[progressDb/insert] ต้องมี staffId จริงจึงบันทึกประวัติได้')
    }
    const { error } = await (supabase as any).from('progress_updates').insert({
      planning_id:     update.planningId,
      staff_id:        update.staffId,
      staff_name:      update.staffName ?? null,
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
      staffId:         r.staff_id      ?? null,
      staffName:       r.staff_name    ?? null,
      testingPercent:  r.testing_percent,
      comment:         r.comment,
      adoSnapshot:     r.ado_snapshot,
      sentToTeams:     r.sent_to_teams,
      teamsSentAt:     r.teams_sent_at,
      createdAt:       r.created_at,
    }))
  },
}
