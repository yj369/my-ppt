import { TextStyle } from '@tiptap/extension-text-style'

type RichTextAttributes = Record<string, string | null | undefined>

function readStyle(element: HTMLElement, property: string) {
  const direct = element.style.getPropertyValue(property)?.trim()
  if (direct) return direct

  if (property === 'font-size') return element.style.fontSize?.trim() || null
  if (property === 'font-weight') return element.style.fontWeight?.trim() || null
  if (property === 'letter-spacing') return element.style.letterSpacing?.trim() || null
  if (property === 'line-height') return element.style.lineHeight?.trim() || null
  if (property === '-webkit-text-stroke-color') return element.style.webkitTextStrokeColor?.trim() || null
  if (property === '-webkit-text-stroke-width') return element.style.webkitTextStrokeWidth?.trim() || null

  return null
}

function renderCssProperty(property: string, value?: string | null) {
  if (!value) return {}
  return { style: `${property}: ${value}` }
}

function parseTextFill(element: HTMLElement) {
  const explicit = element.getAttribute('data-text-fill')?.trim()
  if (explicit) return explicit

  const backgroundImage = element.style.backgroundImage?.trim()
  const backgroundClip = element.style.backgroundClip?.trim()
  const webkitBackgroundClip = element.style.webkitBackgroundClip?.trim()
  if (
    backgroundImage
    && backgroundImage !== 'none'
    && (backgroundClip === 'text' || webkitBackgroundClip === 'text')
  ) {
    return backgroundImage
  }

  return element.style.color?.trim() || null
}

function renderTextFill(value?: string | null) {
  if (!value) return {}

  if (value.startsWith('linear-gradient')) {
    return {
      'data-text-fill': value,
      style: [
        `background-image: ${value}`,
        'color: transparent',
        '-webkit-text-fill-color: transparent',
        'background-clip: text',
        '-webkit-background-clip: text',
      ].join('; '),
    }
  }

  return {
    'data-text-fill': value,
    style: `color: ${value}; -webkit-text-fill-color: ${value}`,
  }
}

export const RichTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => readStyle(element, 'font-size'),
        renderHTML: (attributes: RichTextAttributes) => renderCssProperty('font-size', attributes.fontSize),
      },
      fontWeight: {
        default: null,
        parseHTML: (element: HTMLElement) => readStyle(element, 'font-weight'),
        renderHTML: (attributes: RichTextAttributes) => renderCssProperty('font-weight', attributes.fontWeight),
      },
      letterSpacing: {
        default: null,
        parseHTML: (element: HTMLElement) => readStyle(element, 'letter-spacing'),
        renderHTML: (attributes: RichTextAttributes) => renderCssProperty('letter-spacing', attributes.letterSpacing),
      },
      lineHeight: {
        default: null,
        parseHTML: (element: HTMLElement) => readStyle(element, 'line-height'),
        renderHTML: (attributes: RichTextAttributes) => renderCssProperty('line-height', attributes.lineHeight),
      },
      textFill: {
        default: null,
        parseHTML: (element: HTMLElement) => parseTextFill(element),
        renderHTML: (attributes: RichTextAttributes) => renderTextFill(attributes.textFill),
      },
      textStrokeColor: {
        default: null,
        parseHTML: (element: HTMLElement) => readStyle(element, '-webkit-text-stroke-color'),
        renderHTML: (attributes: RichTextAttributes) => renderCssProperty('-webkit-text-stroke-color', attributes.textStrokeColor),
      },
      textStrokeWidth: {
        default: null,
        parseHTML: (element: HTMLElement) => readStyle(element, '-webkit-text-stroke-width'),
        renderHTML: (attributes: RichTextAttributes) => renderCssProperty('-webkit-text-stroke-width', attributes.textStrokeWidth),
      },
    }
  },
})
