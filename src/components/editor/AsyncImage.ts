import Image from '@tiptap/extension-image'
import { mergeAttributes, type NodeViewRendererProps } from '@tiptap/core'
import { getLocalImageUrl, isLocalImage } from '../../lib/imageStorage'

function syncImageAttributes(element: HTMLImageElement, attributes: Record<string, unknown>) {
  const nextEntries = Object.entries(attributes).filter(([, value]) => value != null)
  const nextKeys = new Set(nextEntries.map(([key]) => key))

  for (const name of element.getAttributeNames()) {
    if (name === 'src') {
      continue
    }

    if (!nextKeys.has(name)) {
      element.removeAttribute(name)
    }
  }

  for (const [key, value] of nextEntries) {
    if (key === 'src') {
      continue
    }

    element.setAttribute(key, String(value))
  }
}

function getImageAttrs(HTMLAttributes: Record<string, unknown>, optionsHtmlAttributes: Record<string, unknown>) {
  return mergeAttributes(optionsHtmlAttributes, HTMLAttributes)
}

/**
 * A custom TipTap Image extension that resolves `idb://` sources inside a NodeView.
 * This keeps persisted content stable while still rendering local images after refresh.
 */
export const AsyncImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
    }
  },

  parseHTML() {
    const imageTag = this.options.allowBase64 ? 'img[src], img[data-async-src]' : 'img[src]:not([src^="data:"]), img[data-async-src]'

    return [
      {
        tag: imageTag,
        getAttrs: (node) => {
          const DOMNode = node as HTMLElement
          const asyncSrc = DOMNode.getAttribute('data-async-src')
          const src = DOMNode.getAttribute('src')

          if (asyncSrc) {
            return {
              src: asyncSrc,
              alt: DOMNode.getAttribute('alt'),
              title: DOMNode.getAttribute('title'),
              width: DOMNode.getAttribute('width'),
              height: DOMNode.getAttribute('height'),
            }
          }
          return {
            src,
            alt: DOMNode.getAttribute('alt'),
            title: DOMNode.getAttribute('title'),
            width: DOMNode.getAttribute('width'),
            height: DOMNode.getAttribute('height'),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    const src = HTMLAttributes.src as string | undefined

    if (!src || !isLocalImage(src)) {
      return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]
    }

    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, {
        ...HTMLAttributes,
        src,
        'data-local-src': src,
      }),
    ]
  },

  addNodeView() {
    return ({ node, HTMLAttributes }: NodeViewRendererProps) => {
      const element = document.createElement('img')
      let currentNode = node
      let resolveVersion = 0
      let destroyed = false

      const resolveSource = async (source: string | null) => {
        const version = ++resolveVersion

        if (!source) {
          element.removeAttribute('src')
          element.removeAttribute('data-local-src')
          return
        }

        if (!isLocalImage(source)) {
          element.setAttribute('src', source)
          element.removeAttribute('data-local-src')
          return
        }

        element.setAttribute('data-local-src', source)

        try {
          const resolvedUrl = await getLocalImageUrl(source)
          if (destroyed || version !== resolveVersion) {
            return
          }

          element.setAttribute('src', resolvedUrl)
        } catch (error) {
          console.error('Failed to resolve local image:', source, error)
        }
      }

      const renderNode = (attrs: Record<string, unknown>) => {
        syncImageAttributes(element, attrs)
        void resolveSource(typeof attrs.src === 'string' ? attrs.src : null)
      }

      renderNode(getImageAttrs(HTMLAttributes, this.options.HTMLAttributes))

      return {
        dom: element,
        update: (updatedNode) => {
          if (updatedNode.type !== currentNode.type) {
            return false
          }

          currentNode = updatedNode
          renderNode(getImageAttrs(updatedNode.attrs as Record<string, unknown>, this.options.HTMLAttributes))
          return true
        },
        destroy: () => {
          destroyed = true
        },
      }
    }
  },
})
