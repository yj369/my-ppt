import { useState, useMemo } from 'react'
import * as LucideIcons from 'lucide-react'
import { Search } from 'lucide-react'

type Props = {
  onSelect: (iconName: string) => void
}

// Build a deduplicated list of icon names from lucide-react exports
const RAW_ICON_ENTRIES = Object.entries(LucideIcons).filter(([name, val]) => {
  // Lucide exports both PascalCase components and utility objects — filter to valid icon components
  if (typeof val !== 'function' && typeof val !== 'object') return false
  if (name === 'default') return false
  // Icon components have a `displayName` or are named functions
  // Skip non-icon exports like 'createLucideIcon', 'icons', 'type X', etc.
  if (/^[a-z]/.test(name)) return false
  return true
})

const ALL_ICON_NAMES: string[] = RAW_ICON_ENTRIES.map(([name]) => name)

export function IconPicker({ onSelect }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_ICON_NAMES
    const q = query.toLowerCase().replace(/[\s-_]/g, '')
    return ALL_ICON_NAMES.filter((name) =>
      name.toLowerCase().replace(/[\s-_]/g, '').includes(q),
    )
  }, [query])

  return (
    <div
      style={{
        width: '320px',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '480px',
      }}
    >
      {/* Search Header */}
      <div
        style={{
          padding: '14px 14px 10px',
          borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索图标 Search…"
            style={{
              width: '100%',
              height: '34px',
              paddingLeft: '32px',
              paddingRight: '10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface-sunken)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          {filtered.length} 个图标
        </p>
      </div>

      {/* Icon Grid */}
      <div
        style={{
          overflowY: 'auto',
          padding: '10px 8px',
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '2px',
        }}
      >
        {filtered.slice(0, 350).map((name) => {
          const IconComp = (LucideIcons as unknown as Record<string, React.FC<{ size?: number; strokeWidth?: number }>>)[name]
          if (!IconComp) return null
          return (
            <button
              key={name}
              title={name}
              type="button"
              onClick={() => onSelect(name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                border: 'none',
                background: 'transparent',
                borderRadius: '6px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                el.style.background = 'rgba(10, 132, 255, 0.1)'
                el.style.color = 'var(--accent)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.background = 'transparent'
                el.style.color = 'var(--text-primary)'
              }}
            >
              <IconComp size={18} strokeWidth={1.5} />
            </button>
          )
        })}
        {filtered.length > 350 && (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '12px 0',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            缩小范围以查看更多图标
          </div>
        )}
      </div>
    </div>
  )
}
