import type { PresentationTheme } from '../../types/editor'

export function SlideBackground({
  theme,
  bg,
}: {
  theme: PresentationTheme
  bg: string
}) {
  return (
    <div className={`slide-surface slide-surface--${bg} theme--${theme}`}>
      <div className="surface-layer surface-layer--base" />
      <div className="surface-layer surface-layer--accent-a" />
      <div className="surface-layer surface-layer--accent-b" />
      <div className="surface-layer surface-layer--noise" />
    </div>
  )
}
