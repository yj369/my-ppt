import { useEditorStore } from '../../store'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'

export function ToastContainer() {
  const { toasts, removeToast } = useEditorStore()

  const icons = {
    success: <CheckCircle2 size={18} className="text-green-400" />,
    error: <AlertCircle size={18} className="text-red-400" />,
    warning: <AlertTriangle size={18} className="text-yellow-400" />,
    info: <Info size={18} className="text-blue-400" />,
  }

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[10001] flex flex-col items-center gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto min-w-[320px] bg-black/90 backdrop-blur-xl border border-white/10 text-white px-6 py-4 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.3)] flex items-center gap-4 animate-toast"
        >
          <div className="flex-shrink-0">{icons[toast.type]}</div>
          <p className="text-sm font-bold tracking-tight flex-1">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-neutral-500 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
