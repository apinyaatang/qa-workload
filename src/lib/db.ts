/**
 * db.ts — thin service layer
 * แปลง snake_case (Supabase) ↔ camelCase (app types)
 * ใช้ any cast เพื่อ bypass generic inference เมื่อ URL ยังไม่ได้ตั้งค่า
 */
import { supabase } from './supabase'
import type {
  Employee, Task, LeaveRecord, PublicHoliday, Project, ImportSession,
} from '../types'

function throwIf(error: unknown, ctx: string) {
  if (error) throw new Error(`[db/${ctx}] ${(error as any).message}`)
}

// ─── Employee ─────────────────────────────────────────────────────────────────
export const employeeDb = {
  async getAll(): Promise<Employee[]> {
    const { data, error } = await (supabase as any)
      .from('employees').select('*').order('first_name')
    throwIf(error, 'employees.getAll')
    return (data ?? []).map((r: any) => ({
      id: r.id, firstName: r.first_name, lastName: r.last_name,
      department: r.department, position: r.position,
      skills: r.skills ?? [], startDate: r.start_date, isActive: r.is_active,
    }))
  },

  async upsert(emp: Employee): Promise<void> {
    const { error } = await (supabase as any).from('employees').upsert({
      id: emp.id, first_name: emp.firstName, last_name: emp.lastName,
      department: emp.department, position: emp.position,
      skills: emp.skills, start_date: emp.startDate, is_active: emp.isActive,
    })
    throwIf(error, 'employees.upsert')
  },

  async delete(id: string): Promise<void> {
    const { error } = await (supabase as any).from('employees').delete().eq('id', id)
    throwIf(error, 'employees.delete')
  },
}

// ─── Project ──────────────────────────────────────────────────────────────────
export const projectDb = {
  async getAll(): Promise<Project[]> {
    const { data, error } = await (supabase as any)
      .from('projects').select('*').order('created_at', { ascending: false })
    throwIf(error, 'projects.getAll')
    return (data ?? []).map((r: any) => ({
      id: r.id, code: r.code, name: r.name,
      description: r.description ?? undefined,
      department: r.department, ownerId: r.owner_id ?? '',
      startDate: r.start_date, endDate: r.end_date ?? undefined,
      status: r.status as Project['status'],
      budget: r.budget ?? undefined,
      createdAt: r.created_at.slice(0, 10),
    }))
  },

  async upsert(p: Project): Promise<void> {
    const { error } = await (supabase as any).from('projects').upsert({
      id: p.id, code: p.code, name: p.name,
      description: p.description ?? null,
      department: p.department, owner_id: p.ownerId || null,
      start_date: p.startDate, end_date: p.endDate ?? null,
      status: p.status, budget: p.budget ?? null,
    })
    throwIf(error, 'projects.upsert')
  },

  async delete(id: string): Promise<void> {
    const { error } = await (supabase as any).from('projects').delete().eq('id', id)
    throwIf(error, 'projects.delete')
  },
}

// ─── Task ─────────────────────────────────────────────────────────────────────
export const taskDb = {
  async getAll(): Promise<Task[]> {
    const { data, error } = await (supabase as any)
      .from('tasks').select('*').order('created_at')
    throwIf(error, 'tasks.getAll')
    return (data ?? []).map((r: any) => ({
      id: r.id, name: r.name, assigneeIds: r.assignee_ids ?? [],
      estimatedHours: r.estimated_hours, deadline: r.deadline,
      taskType: r.task_type as Task['taskType'],
      source: r.source as Task['source'],
      status: r.status as Task['status'],
      periodStart: r.period_start, periodEnd: r.period_end,
      description: r.description ?? undefined,
      azureWorkItemId: r.azure_work_item_id ?? undefined,
    }))
  },

  async upsert(t: Task): Promise<void> {
    const { error } = await (supabase as any).from('tasks').upsert({
      id: t.id, name: t.name, assignee_ids: t.assigneeIds,
      estimated_hours: t.estimatedHours, deadline: t.deadline,
      task_type: t.taskType, source: t.source, status: t.status,
      period_start: t.periodStart, period_end: t.periodEnd,
      description: t.description ?? null,
      azure_work_item_id: t.azureWorkItemId ?? null,
    })
    throwIf(error, 'tasks.upsert')
  },

  async delete(id: string): Promise<void> {
    const { error } = await (supabase as any).from('tasks').delete().eq('id', id)
    throwIf(error, 'tasks.delete')
  },

  async replacePlanned(periodStart: string, periodEnd: string, newTasks: Task[]): Promise<void> {
    const { error: delErr } = await (supabase as any).from('tasks')
      .delete()
      .eq('task_type', 'Planned')
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
    throwIf(delErr, 'tasks.replacePlanned.delete')
    if (newTasks.length === 0) return
    const { error: insErr } = await (supabase as any).from('tasks').insert(
      newTasks.map(t => ({
        id: t.id, name: t.name, assignee_ids: t.assigneeIds,
        estimated_hours: t.estimatedHours, deadline: t.deadline,
        task_type: t.taskType, source: t.source, status: t.status,
        period_start: t.periodStart, period_end: t.periodEnd,
        description: t.description ?? null,
        azure_work_item_id: t.azureWorkItemId ?? null,
      }))
    )
    throwIf(insErr, 'tasks.replacePlanned.insert')
  },
}

// ─── Leave Record ─────────────────────────────────────────────────────────────
export const leaveDb = {
  async getAll(): Promise<LeaveRecord[]> {
    const { data, error } = await (supabase as any)
      .from('leave_records').select('*').order('date')
    throwIf(error, 'leaves.getAll')
    return (data ?? []).map((r: any) => ({
      id: r.id, employeeId: r.employee_id, date: r.date,
      leaveType: r.leave_type as LeaveRecord['leaveType'],
      status: r.status as LeaveRecord['status'],
      note: r.note ?? undefined,
    }))
  },

  async insert(l: LeaveRecord): Promise<void> {
    const { error } = await (supabase as any).from('leave_records').insert({
      id: l.id, employee_id: l.employeeId, date: l.date,
      leave_type: l.leaveType, status: l.status, note: l.note ?? null,
    })
    throwIf(error, 'leaves.insert')
  },

  async updateStatus(id: string, status: 'approved' | 'rejected'): Promise<void> {
    const { error } = await (supabase as any).from('leave_records')
      .update({ status }).eq('id', id)
    throwIf(error, 'leaves.updateStatus')
  },
}

// ─── Public Holiday ───────────────────────────────────────────────────────────
export const holidayDb = {
  async getAll(): Promise<PublicHoliday[]> {
    const { data, error } = await (supabase as any)
      .from('public_holidays').select('*').order('date')
    throwIf(error, 'holidays.getAll')
    return (data ?? []).map((r: any) => ({ id: r.id, date: r.date, name: r.name }))
  },

  async insert(h: PublicHoliday): Promise<void> {
    const { error } = await (supabase as any).from('public_holidays')
      .insert({ id: h.id, date: h.date, name: h.name })
    throwIf(error, 'holidays.insert')
  },

  async delete(id: string): Promise<void> {
    const { error } = await (supabase as any).from('public_holidays').delete().eq('id', id)
    throwIf(error, 'holidays.delete')
  },
}

// ─── Import Session ───────────────────────────────────────────────────────────
export const importDb = {
  async getAll(): Promise<ImportSession[]> {
    const { data, error } = await (supabase as any)
      .from('import_sessions').select('*').order('imported_at', { ascending: false })
    throwIf(error, 'imports.getAll')
    return (data ?? []).map((r: any) => ({
      id: r.id, fileName: r.file_name, importedAt: r.imported_at,
      importStatus: r.import_status as ImportSession['importStatus'],
      totalRows: r.total_rows, successRows: r.success_rows, errorRows: r.error_rows,
      rows: r.rows as ImportSession['rows'],
      appliedToTasks: r.applied_to_tasks,
    }))
  },

  async insert(s: ImportSession): Promise<void> {
    const { error } = await (supabase as any).from('import_sessions').insert({
      id: s.id, file_name: s.fileName, imported_at: s.importedAt,
      import_status: s.importStatus, total_rows: s.totalRows,
      success_rows: s.successRows, error_rows: s.errorRows,
      rows: s.rows, applied_to_tasks: s.appliedToTasks,
    })
    throwIf(error, 'imports.insert')
  },

  async markApplied(id: string): Promise<void> {
    const { error } = await (supabase as any).from('import_sessions')
      .update({ applied_to_tasks: true }).eq('id', id)
    throwIf(error, 'imports.markApplied')
  },

  async delete(id: string): Promise<void> {
    const { error } = await (supabase as any).from('import_sessions').delete().eq('id', id)
    throwIf(error, 'imports.delete')
  },
}
