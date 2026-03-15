export type RgbaColor = {
  r: number
  g: number
  b: number
  a: number
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function clampAlpha(value: number) {
  return Math.max(0, Math.min(1, value))
}

function toHex(value: number) {
  return clampByte(value).toString(16).padStart(2, '0')
}

export function parseCssColor(value?: string | null): RgbaColor | null {
  if (!value) return null

  const trimmed = value.trim()
  if (trimmed.toLowerCase() === 'transparent') {
    return {
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    }
  }

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1)
    if (hex.length === 3) {
      return {
        r: parseInt(`${hex[0]}${hex[0]}`, 16),
        g: parseInt(`${hex[1]}${hex[1]}`, 16),
        b: parseInt(`${hex[2]}${hex[2]}`, 16),
        a: 1,
      }
    }

    if (hex.length === 4) {
      return {
        r: parseInt(`${hex[0]}${hex[0]}`, 16),
        g: parseInt(`${hex[1]}${hex[1]}`, 16),
        b: parseInt(`${hex[2]}${hex[2]}`, 16),
        a: parseInt(`${hex[3]}${hex[3]}`, 16) / 255,
      }
    }

    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      }
    }

    return null
  }

  const rgbMatch = trimmed.match(/^rgba?\(\s*([^)]+)\s*\)$/i)
  if (!rgbMatch) {
    return null
  }

  const parts = rgbMatch[1].split(',').map((part) => part.trim())
  if (parts.length < 3 || parts.length > 4) {
    return null
  }

  const channels = parts.slice(0, 3).map(Number)
  if (channels.some((channel) => !Number.isFinite(channel))) {
    return null
  }

  const alpha = parts[3] === undefined ? 1 : Number(parts[3])
  if (!Number.isFinite(alpha)) {
    return null
  }

  return {
    r: clampByte(channels[0]),
    g: clampByte(channels[1]),
    b: clampByte(channels[2]),
    a: clampAlpha(alpha),
  }
}

export function rgbaToHex(color: RgbaColor) {
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`
}

export function formatCssColor(color: RgbaColor, format: 'hex' | 'rgba' = color.a < 1 ? 'rgba' : 'hex') {
  if (format === 'hex' && color.a >= 1) {
    return rgbaToHex(color)
  }

  const alpha = Number(color.a.toFixed(3))
  return `rgba(${clampByte(color.r)}, ${clampByte(color.g)}, ${clampByte(color.b)}, ${alpha})`
}

export function withAlpha(color: RgbaColor, alpha: number): RgbaColor {
  return {
    ...color,
    a: clampAlpha(alpha),
  }
}
