import { useState, useEffect } from 'react'
import { GitBranch, ExternalLink, RefreshCw } from 'lucide-react'

const REPO_OWNER = 'yj369'
const REPO_NAME = 'my-ppt'
const TAGS_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/tags`
const COMMITS_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=1`

declare const __APP_VERSION__: string

export function GitHubVersionChecker() {
  const [status, setStatus] = useState<{ 
    isUpToDate: boolean;
    dateLabel: string;
    url: string;
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const localSha = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''

  const fetchVersion = async () => {
    setLoading(true)
    setError(false)
    try {
      const commitsRes = await fetch(COMMITS_API)
      if (!commitsRes.ok) throw new Error()
      
      const commits = await commitsRes.json()
      if (Array.isArray(commits) && commits.length > 0) {
        const latest = commits[0]
        const remoteSha = latest.sha.substring(0, 7)
        const isUpToDate = localSha === remoteSha
        
        const d = new Date(latest.commit.committer.date)
        const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日`
        
        setStatus({
          isUpToDate,
          dateLabel,
          url: latest.html_url
        })
      }
    } catch (err) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVersion()
  }, [])

  if (error) return null // 出错时不显示，保持界面整洁

  return (
    <div className="flex items-center gap-3 animate-in fade-in duration-700">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
        status && !status.isUpToDate 
          ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm' 
          : 'bg-white border-neutral-100 text-neutral-400'
      }`}>
        {loading ? (
          <RefreshCw size={10} className="animate-spin" />
        ) : (
          <div className={`w-1.5 h-1.5 rounded-full ${status?.isUpToDate ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
        )}
        
        <span className="text-[11px] font-bold tracking-tight">
          {loading ? '检查中...' : status?.isUpToDate ? '代码已是最新' : `发现更新 (${status?.dateLabel})`}
        </span>

        {status && !status.isUpToDate && (
          <a 
            href={status.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 p-0.5 hover:bg-amber-200 rounded transition-colors"
          >
            <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  )
}
