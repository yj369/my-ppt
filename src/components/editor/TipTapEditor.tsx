import { useEditor, EditorContent } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import StarterKit from '@tiptap/starter-kit'
import { mergeAttributes } from '@tiptap/core'
import FontFamily from '@tiptap/extension-font-family'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { useEffect, useRef, useMemo } from 'react'
import { RichTextStyle } from '../../lib/tiptap-extensions'
import { useEditorStore } from '../../store'
import type { EditorBlock } from '../../types/editor'
import { AsyncImage } from './AsyncImage'

type TipTapEditorProps = {
  block: EditorBlock
  slideId: string
  isEditing: boolean
}

const TableDocument = Document.extend({
  content: 'table',
})

function readTableCellStyle(element: HTMLElement, property: string) {
  if (property === 'background') {
    return element.style.background?.trim()
      || element.style.backgroundColor?.trim()
      || null
  }

  if (property === 'padding') {
    return element.style.padding?.trim()
      || element.style.paddingTop?.trim()
      || null
  }

  if (property === 'border-width') return element.style.borderWidth?.trim() || null
  if (property === 'border-style') return element.style.borderStyle?.trim() || null
  if (property === 'border-color') return element.style.borderColor?.trim() || null
  if (property === 'text-align') return element.style.textAlign?.trim() || null
  if (property === 'vertical-align') return element.style.verticalAlign?.trim() || null

  return element.style.getPropertyValue(property)?.trim() || null
}

function renderTableCellStyle(property: string, value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return {}
  }

  const normalized = typeof value === 'number'
    ? `${value}px`
    : String(value)

  return { style: `${property}: ${normalized}` }
}

function parseTableCellNumericStyle(element: HTMLElement, property: string) {
  const raw = readTableCellStyle(element, property)
  if (!raw) return null

  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : null
}

const tableCellAttributes = {
  cellBackground: {
    default: null,
    parseHTML: (element: HTMLElement) => readTableCellStyle(element, 'background'),
    renderHTML: (attributes: Record<string, string | number | null | undefined>) =>
      renderTableCellStyle('background', attributes.cellBackground),
  },
  cellTextAlign: {
    default: null,
    parseHTML: (element: HTMLElement) => readTableCellStyle(element, 'text-align'),
    renderHTML: (attributes: Record<string, string | number | null | undefined>) =>
      renderTableCellStyle('text-align', attributes.cellTextAlign),
  },
  cellVerticalAlign: {
    default: null,
    parseHTML: (element: HTMLElement) => readTableCellStyle(element, 'vertical-align'),
    renderHTML: (attributes: Record<string, string | number | null | undefined>) =>
      renderTableCellStyle('vertical-align', attributes.cellVerticalAlign),
  },
  cellPadding: {
    default: null,
    parseHTML: (element: HTMLElement) => parseTableCellNumericStyle(element, 'padding'),
    renderHTML: (attributes: Record<string, string | number | null | undefined>) =>
      renderTableCellStyle('padding', attributes.cellPadding),
  },
  cellBorderColor: {
    default: null,
    parseHTML: (element: HTMLElement) => readTableCellStyle(element, 'border-color'),
    renderHTML: (attributes: Record<string, string | number | null | undefined>) =>
      renderTableCellStyle('border-color', attributes.cellBorderColor),
  },
  cellBorderWidth: {
    default: null,
    parseHTML: (element: HTMLElement) => parseTableCellNumericStyle(element, 'border-width'),
    renderHTML: (attributes: Record<string, string | number | null | undefined>) =>
      renderTableCellStyle('border-width', attributes.cellBorderWidth),
  },
  cellBorderStyle: {
    default: null,
    parseHTML: (element: HTMLElement) => readTableCellStyle(element, 'border-style'),
    renderHTML: (attributes: Record<string, string | number | null | undefined>) =>
      renderTableCellStyle('border-style', attributes.cellBorderStyle),
  },
}

const StyledTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...tableCellAttributes,
    }
  },
})

const StyledTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...tableCellAttributes,
    }
  },
  renderHTML({ HTMLAttributes }) {
    return ['th', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
})

const getExtensions = (blockType: string) => {
  const isTable = blockType === 'table'

  const baseExtensions = [
    isTable ? StarterKit.configure({ document: false }) : StarterKit,
    ...(isTable ? [TableDocument] : []),
    RichTextStyle,
    FontFamily,
    Underline,
    Subscript,
    Superscript,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Placeholder.configure({
      placeholder: isTable ? '' : '输入文本...',
    }),
    AsyncImage.configure({
      allowBase64: true,
    }),
    Table.configure({
      resizable: true,
      allowTableNodeSelection: true,
      HTMLAttributes: {
        class: 'kn-table',
      },
    }),
    TableRow,
    StyledTableHeader,
    StyledTableCell,
  ]

  return baseExtensions
}

export function TipTapEditor({ block, slideId, isEditing }: TipTapEditorProps) {
  const updateBlock = useEditorStore((state) => state.updateBlock)
  const activeBlockId = useEditorStore((state) => state.activeBlockId)
  const setActiveEditor = useEditorStore((state) => state.setActiveEditor)
  const setEditingTextBlock = useEditorStore((state) => state.setEditingTextBlock)
  const lastContentRef = useRef(block.content)

  const extensions = useMemo(() => getExtensions(block.type), [block.type])

  const editor = useEditor({
    extensions,
    content: block.content,
    editable: isEditing,
    editorProps: {
      handleKeyDown: (_, event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          setEditingTextBlock(null)
          return true
        }

        return false
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      if (html !== lastContentRef.current) {
        lastContentRef.current = html
        updateBlock(slideId, block.id, { content: html })
      }
    },
    onFocus: ({ editor }) => {
      if (isEditing && block.id === activeBlockId) {
        setActiveEditor(editor)
      }
    },
  })

  // Only expose the editor to the inspector while this block is in edit mode.
  useEffect(() => {
    if (!editor) return

    if (isEditing && block.id === activeBlockId) {
      setActiveEditor(editor)
      return
    }

    if (useEditorStore.getState().activeEditor === editor) {
      setActiveEditor(null)
    }
  }, [activeBlockId, block.id, editor, isEditing, setActiveEditor])

  // Synchronize external content changes
  useEffect(() => {
    if (editor && block.content !== editor.getHTML()) {
      // Only update if not currently focused to avoid jumpy cursor
      if (!editor.isFocused) {
        editor.commands.setContent(block.content, { emitUpdate: false })
        lastContentRef.current = block.content
      }
    }
  }, [block.content, editor])

  // Synchronize editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing)
      if (isEditing) {
        editor.commands.focus()
      }
    }
  }, [editor, isEditing])

  // Cleanup active editor when this component unmounts
  useEffect(() => {
    return () => {
      if (useEditorStore.getState().activeEditor === editor) {
        setActiveEditor(null)
      }
    }
  }, [editor, setActiveEditor])

  if (!editor) {
    return null
  }

  return (
    <div className="kn2-tiptap-container" style={{ width: '100%', height: '100%' }}>
      <EditorContent editor={editor} />
    </div>
  )
}
