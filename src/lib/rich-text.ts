import type { TextAlign } from '../types/editor'

export type SelectedTextStyles = {
  fontFamily: string | null
  fontSize: number | null
  fontWeight: string | null
  fontStyle: string | null
  textDecoration: string | null
  textAlign: TextAlign | null
  letterSpacing: number | null
  lineHeight: number | null
  textColor: string | null
  textStrokeColor: string | null
  textStrokeWidth: number | null
  isBold: boolean | null
  isItalic: boolean | null
  isUnderline: boolean | null
  isStrikeThrough: boolean | null
}
