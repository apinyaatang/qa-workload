export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string
          first_name: string
          last_name: string
          department: string
          position: string
          skills: string[]
          start_date: string
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['employees']['Insert']>
      }
      projects: {
        Row: {
          id: string
          code: string
          name: string
          description: string | null
          department: string
          owner_id: string | null
          start_date: string
          end_date: string | null
          status: string
          budget: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      tasks: {
        Row: {
          id: string
          name: string
          assignee_ids: string[]
          estimated_hours: number
          deadline: string
          task_type: string
          source: string
          status: string
          period_start: string
          period_end: string
          description: string | null
          azure_work_item_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
      }
      leave_records: {
        Row: {
          id: string
          employee_id: string
          date: string
          leave_type: string
          status: string
          note: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['leave_records']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['leave_records']['Insert']>
      }
      public_holidays: {
        Row: {
          id: string
          date: string
          name: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['public_holidays']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['public_holidays']['Insert']>
      }
      import_sessions: {
        Row: {
          id: string
          file_name: string
          imported_at: string
          import_status: string
          total_rows: number
          success_rows: number
          error_rows: number
          rows: Json
          applied_to_tasks: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['import_sessions']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['import_sessions']['Insert']>
      }
    }
  }
}
