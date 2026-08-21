import { Loader2, ShieldOff, UserX, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import LoginPage from './LoginPage'

/**
 * กั้นหน้าแอปทั้งหมด
 *
 * ทุกสถานะของ AuthState ต้องมีหน้าจอรองรับที่นี่ — นั่นคือเหตุผลที่ AuthState
 * เป็น discriminated union ไม่ใช่กองของ field ที่ null ได้: TypeScript จะฟ้อง
 * ถ้ามีสถานะไหนไม่ได้จัดการ แทนที่จะปล่อยให้ผู้ใช้เจอหน้าจอว่างเปล่า
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { state } = useAuth()

  switch (state.status) {
    // auth ปิดอยู่ (โหมด demo หรือยังไม่เปิด login) — ปล่อยผ่านเหมือนก่อนมี auth
    case 'auth-disabled':
      return <>{children}</>

    case 'loading':
      return <Splash />

    case 'signed-out':
      return <LoginPage />

    case 'authenticated':
      return <>{children}</>

    case 'profile-missing':
      return (
        <Blocked
          icon={<UserX size={26} className="text-amber-600 dark:text-amber-400" />}
          tone="amber"
          title="ยังไม่มีข้อมูลผู้ใช้ในระบบ"
          detail={`เข้าสู่ระบบสำเร็จแล้ว แต่ไม่พบโปรไฟล์ของบัญชีนี้ (${state.user.email ?? state.user.id})`}
          hint="กรุณาแจ้ง Admin ให้เพิ่มโปรไฟล์ให้ — ระบบจะยังใช้งานไม่ได้จนกว่าจะมีโปรไฟล์"
        />
      )

    case 'deactivated':
      return (
        <Blocked
          icon={<ShieldOff size={26} className="text-red-600 dark:text-red-400" />}
          tone="red"
          title="บัญชีนี้ถูกปิดการใช้งาน"
          detail={`บัญชี ${state.profile.email ?? state.user.id} ถูกปิดการใช้งานโดย Admin`}
          hint="หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อ Admin เพื่อเปิดการใช้งานอีกครั้ง"
        />
      )
  }
}

function Splash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={34} className="animate-spin text-indigo-600" />
        <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">
          กำลังตรวจสอบสิทธิ์…
        </p>
      </div>
    </div>
  )
}

function Blocked({
  icon, tone, title, detail, hint,
}: {
  icon: React.ReactNode
  tone: 'amber' | 'red'
  title: string
  detail: string
  hint: string
}) {
  const { signOut } = useAuth()
  const ring = tone === 'red'
    ? 'bg-red-50 dark:bg-red-900/20'
    : 'bg-amber-50 dark:bg-amber-900/20'

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl px-8 py-8 text-center space-y-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${ring}`}>
          {icon}
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h1>
        <p className="text-sm text-gray-600 dark:text-slate-300">{detail}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500">{hint}</p>
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 py-2.5 mt-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <LogOut size={15} /> ออกจากระบบ
        </button>
      </div>
    </div>
  )
}
