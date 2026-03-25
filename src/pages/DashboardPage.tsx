import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Edit3, Presentation, Download, Upload, CheckCircle2, X, LayoutGrid } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../lib/db'
import { createDemoPresentation } from '../lib/presentation'
import { useEditorStore } from '../store'
import type { Project } from '../types/editor'

export function DashboardPage() {
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray())
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const confirm = useEditorStore((state) => state.confirm)
  const addToast = useEditorStore((state) => state.addToast)

  const handleCreateNew = async () => {
    const id = uuidv4()
    const demo = createDemoPresentation()
    const now = Date.now()
    const newProject: Project = {
      id,
      name: '未命名演示文稿',
      createdAt: now,
      updatedAt: now,
      ...demo,
    }
    await db.projects.add(newProject)
    addToast('已成功创建新演示文稿', 'success')
    navigate(`/editor/${id}`)
  }

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const ok = await confirm({
      title: '确认删除',
      message: '确定要删除这个演示项目吗？此操作一旦执行将无法撤销。',
      confirmLabel: '立即移除',
      isDestructive: true,
    })
    if (ok) {
      await db.projects.delete(id)
      setSelectedIds(prev => prev.filter(item => item !== id))
      addToast('已移除演示文稿', 'success')
    }
  }

  const handleBatchDelete = async () => {
    const ok = await confirm({
      title: '批量删除确认',
      message: `您正准备彻底删除选中的 ${selectedIds.length} 个演示项目。这些文件将从本地数据库中永久消失。`,
      confirmLabel: '全部移除',
      isDestructive: true,
    })
    if (ok) {
      const count = selectedIds.length
      await db.projects.bulkDelete(selectedIds)
      setSelectedIds([])
      addToast(`已成功删除 ${count} 个演示项目`, 'success')
    }
  }

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (!projects) return
    if (selectedIds.length === projects.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(projects.map(p => p.id))
    }
  }

  const handleExport = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name}.tarot`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-[#f8f8fa] text-neutral-900 p-8 pb-32 selection:bg-neutral-200">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-end mb-16 animate-mask">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg shadow-neutral-200">
                <LayoutGrid size={22} className="text-white" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-black">项目库</h1>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-2xl hover:bg-neutral-800 transition-all active:scale-95 shadow-xl shadow-neutral-300"
            >
              <Plus size={20} />
              <span className="text-sm font-bold">新建演示</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects?.map((project, index) => {
            const isSelected = selectedIds.includes(project.id)
            return (
              <div
                key={project.id}
                onClick={() => selectedIds.length > 0 ? toggleSelect(project.id, {} as any) : navigate(`/editor/${project.id}`)}
                className={`group relative bg-black rounded-xl transition-all cursor-pointer overflow-hidden border border-neutral-800 shadow-sm stagger-item ${
                  isSelected ? 'ring-2 ring-white ring-offset-4 ring-offset-[#f8f8fa] scale-[1.02]' : 'hover:border-neutral-600 hover:shadow-xl hover:-translate-y-1'
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* 选择标记 */}
                <div 
                  onClick={(e) => toggleSelect(project.id, e)}
                  className={`absolute top-4 left-4 z-10 w-6 h-6 rounded-md border transition-all flex items-center justify-center ${
                    isSelected ? 'bg-white border-white text-black scale-110' : 'bg-black/40 border-white/20 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {isSelected && <CheckCircle2 size={14} fill="currentColor" />}
                </div>

                <div className="aspect-video bg-[#0a0a0a] flex items-center justify-center relative overflow-hidden border-b border-neutral-900">
                  {project.thumbnail ? (
                    <img src={project.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105" alt={project.name} />
                  ) : (
                    <Presentation size={48} className="text-neutral-900" />
                  )}
                </div>
                
                <div className="p-5 text-white">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-neutral-100 truncate flex-1 mr-4 text-lg tracking-tight">{project.name}</h3>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleExport(project, e)}
                        className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white transition-colors"
                        title="导出"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(project.id, e)}
                        className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-red-500 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center text-xs font-bold text-neutral-600 gap-4">
                    <span className="flex items-center gap-1.5 uppercase tracking-wider">
                      <Edit3 size={12} />
                      {new Date(project.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="ml-auto border border-neutral-800 px-2 py-0.5 rounded text-[9px] font-black tracking-widest text-neutral-500 uppercase">
                      {project.slides.length} 页演示
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 极致黑色悬浮底栏 */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-10 duration-500">
            <div className="bg-black text-white shadow-[0_40px_80px_rgba(0,0,0,0.3)] rounded-[2rem] px-8 py-5 flex items-center gap-12 min-w-[480px]">
              <div className="flex flex-col">
                <span className="text-base font-black tracking-tight">已选中 {selectedIds.length} 项</span>
                <button 
                  onClick={toggleSelectAll}
                  className="text-xs font-bold text-neutral-500 hover:text-white transition-colors text-left tracking-widest"
                >
                  {projects && selectedIds.length === projects.length ? '取消全选' : '全选所有项目'}
                </button>
              </div>
              
              <div className="h-10 w-px bg-neutral-800" />
              
              <div className="flex items-center gap-5 ml-auto">
                <button 
                  onClick={() => setSelectedIds([])}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-black text-neutral-400 hover:text-white transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleBatchDelete}
                  className="flex items-center gap-3 px-8 py-3 bg-red-600 text-white text-sm font-black rounded-2xl hover:bg-red-500 transition-all active:scale-95 shadow-lg shadow-red-900/20"
                >
                  <Trash2 size={20} />
                  彻底删除
                </button>
              </div>
            </div>
          </div>
        )}

        {projects && projects.length === 0 && (
          <div className="col-span-full py-48 text-center">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-neutral-200 border border-neutral-100">
              <Presentation size={48} className="text-neutral-200" />
            </div>
            <h3 className="text-3xl font-black text-black mb-4 tracking-tight">暂无演示项目</h3>
            <p className="text-neutral-400 mb-12 text-xl font-medium tracking-widest">开启您的创作之旅</p>
            <button
              onClick={handleCreateNew}
              className="inline-flex items-center gap-3 px-12 py-5 bg-black text-white rounded-[2rem] hover:bg-neutral-800 transition-all font-black text-lg shadow-2xl shadow-neutral-400"
            >
              <Plus size={28} />
              <span>新建演示项目</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
