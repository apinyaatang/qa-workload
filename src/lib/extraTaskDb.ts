import { supabase, isConfigured } from './supabase'
import type { ExtraTask } from '../types/extraTask'

function throwIf(error: unknown, ctx: string) {
  if (error) throw new Error(`[extraTaskDb/${ctx}] ${(error as any).message}`)
}

function fromRow(r: any): ExtraTask {
  const rawFlag = r.tester_flag
  const testerFlag: string[] = Array.isArray(rawFlag)
    ? rawFlag
    : typeof rawFlag === 'string'
    ? (() => { try { return JSON.parse(rawFlag) } catch { return [] } })()
    : []
  return {
    id:              r.id,
    tester:          r.tester              ?? null,
    projectName:     r.project_name        ?? '',
    type:            r.type                ?? '',
    status:          r.status              ?? '',
    goLiveDate:      r.go_live_date        ?? null,
    testingPercent:  r.testing_percent     ?? null,
    testEstimateDay: r.test_estimate_day   ?? null,
    testerFlag,
    remark:          r.remark              ?? null,
    createdAt:       r.created_at,
    updatedAt:       r.updated_at,
  }
}

export const extraTaskDb = {
  async getAll(): Promise<ExtraTask[]> {
    if (!isConfigured) return []
    const { data, error } = await (supabase as any)
      .from('extra_tasks')
      .select('*')
      .order('created_at', { ascending: false })
    throwIf(error, 'getAll')
    return (data ?? []).map(fromRow)
  },

  async insert(task: Omit<ExtraTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExtraTask> {
    const payload: Record<string, unknown> = {
      tester:            task.tester            ?? null,
      project_name:      task.projectName,
      type:              task.type              ?? null,
      status:            task.status            ?? null,
      go_live_date:      task.goLiveDate        ?? null,
      testing_percent:   task.testingPercent    ?? null,
      test_estimate_day: task.testEstimateDay   ?? null,
      remark:            task.remark            ?? null,
    }
    // include tester_flag only when it has values (column may not exist until SQL is run)
    if (task.testerFlag?.length) payload.tester_flag = task.testerFlag
    const { data, error } = await (supabase as any)
      .from('extra_tasks')
      .insert(payload)
      .select()
      .single()
    throwIf(error, 'insert')
    return fromRow(data)
  },

  async updateFieldsChecked(
    id: string,
    fields: Record<string, unknown>,
    knownUpdatedAt?: string,
  ): Promise<{ ok: true; updatedAt: string } | { ok: false; reason: 'conflict' | 'error' }> {
    if (!isConfigured) return { ok: true, updatedAt: new Date().toISOString() }
    try {
      let q = (supabase as any)
        .from('extra_tasks')
        .update(fields)
        .eq('id', id)
      if (knownUpdatedAt) q = q.eq('updated_at', knownUpdatedAt)
      const { data, error } = await q.select('updated_at')
      if (error) return { ok: false, reason: 'error' }
      if (!data || data.length === 0) return { ok: false, reason: 'conflict' }
      return { ok: true, updatedAt: data[0].updated_at as string }
    } catch {
      return { ok: false, reason: 'error' }
    }
  },

  async deleteById(id: string): Promise<void> {
    if (!isConfigured) return
    const { error } = await (supabase as any)
      .from('extra_tasks').delete().eq('id', id)
    throwIf(error, 'deleteById')
  },
}
