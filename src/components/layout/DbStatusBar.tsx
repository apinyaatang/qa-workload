import { X, Wifi, WifiOff, Database, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../context/AppContext'

export default function DbStatusBar() {
  const { isLoading, dbError, isOnline } = useApp()
  const [dismissed, setDismissed] = useState(false)

  if (isLoading) {
    return (
      <div className="bg-indigo-600 text-white text-xs px-4 py-2 flex items-center gap-2">
        <Loader2 size={13} className="animate-spin shrink-0" />
        กำลังโหลดข้อมูลจาก Supabase...
      </div>
    )
  }

  if (dbError && !dismissed) {
    return (
      <div className="bg-red-500 text-white text-xs px-4 py-2 flex items-center gap-2">
        <WifiOff size={13} className="shrink-0" />
        <span className="flex-1">{dbError}</span>
        <button onClick={() => setDismissed(true)} className="hover:opacity-70">
          <X size={13} />
        </button>
      </div>
    )
  }

  if (!isOnline && !dismissed) {
    return (
      <div className="bg-yellow-500 text-white text-xs px-4 py-2 flex items-center gap-2">
        <WifiOff size={13} className="shrink-0" />
        <span className="flex-1">ทำงานในโหมด Offline — ข้อมูลเก็บในเบราว์เซอร์ (ใส่ Supabase key ใน .env เพื่อเปิดใช้ database)</span>
        <button onClick={() => setDismissed(true)} className="hover:opacity-70">
          <X size={13} />
        </button>
      </div>
    )
  }

  if (isOnline) {
    return (
      <div className="bg-green-600 text-white text-xs px-4 py-2 flex items-center gap-2">
        <Database size={13} className="shrink-0" />
        เชื่อมต่อ Supabase แล้ว — ข้อมูลถูกบันทึกลง Database
        <Wifi size={13} className="ml-auto shrink-0 opacity-70" />
      </div>
    )
  }

  return null
}
