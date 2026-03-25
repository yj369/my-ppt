import { useEditorStore } from '../../store'
import { AlertTriangle, X } from 'lucide-react'

export function ConfirmDialog() {
  const confirmDialog = useEditorStore((state) => state.confirmDialog)

  if (!confirmDialog || !confirmDialog.isOpen) return null

  const { options, resolve } = confirmDialog

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/40 animate-mask"
        onClick={() => resolve(false)}
      />
      
      {/* 对话框主体 */}
      <div className="relative bg-black text-white w-full max-w-[420px] rounded-[2.5rem] p-10 shadow-[0_40px_100px_rgba(0,0,0,0.5)] border border-neutral-800 animate-confirm">
        
        {/* 关闭按钮 */}
        <button 
          onClick={() => resolve(false)}
          className="absolute top-8 right-8 text-neutral-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* 图标 */}
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-8 ${
            options.isDestructive ? 'bg-red-500 text-white shadow-lg shadow-red-900/20' : 'bg-white text-black'
          }`}>
            <AlertTriangle size={32} />
          </div>

          <h2 className="text-2xl font-black mb-4 tracking-tight leading-tight">
            {options.title}
          </h2>
          
          <p className="text-neutral-400 font-medium leading-relaxed mb-10 text-lg">
            {options.message}
          </p>

          <div className="flex gap-4 w-full">
            <button
              onClick={() => resolve(false)}
              className="flex-1 px-8 py-4 bg-neutral-900 text-white font-black rounded-2xl hover:bg-neutral-800 transition-all active:scale-95"
            >
              {options.cancelLabel || '取消'}
            </button>
            <button
              onClick={() => resolve(true)}
              className={`flex-1 px-8 py-4 font-black rounded-2xl transition-all active:scale-95 shadow-xl ${
                options.isDestructive 
                  ? 'bg-red-600 text-white hover:bg-red-500 shadow-red-900/20' 
                  : 'bg-white text-black hover:bg-neutral-200 shadow-neutral-900/10'
              }`}
            >
              {options.confirmLabel || '确定'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
