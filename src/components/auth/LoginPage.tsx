import { useState } from 'react'
import { BarChart2, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err: any) {
      setError(err.message ?? 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบ Email หรือ Password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        {/* Logo header */}
        <div className="bg-indigo-600 rounded-t-2xl px-8 py-8 text-center">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <BarChart2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">WorkloadIQ</h1>
          <p className="text-indigo-200 text-sm mt-1">QA Workload Management</p>
        </div>

        {/* Form card */}
        <div className="bg-white dark:bg-slate-800 rounded-b-2xl shadow-xl px-8 py-8 space-y-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white text-center">เข้าสู่ระบบ</h2>

          {error && (
            <div className="flex items-start gap-2 px-3 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 dark:placeholder-slate-400"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-9 pr-10 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 dark:placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 dark:text-slate-500 pt-2 border-t border-gray-100 dark:border-slate-700">
            ไม่สามารถสมัครได้ — ติดต่อ Admin เพื่อขอสิทธิ์เข้าใช้
          </p>
        </div>
      </div>
    </div>
  )
}
