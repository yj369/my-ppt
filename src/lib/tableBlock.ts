import type { Editor } from '@tiptap/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'
import { CellSelection, TableMap, findCell, isInTable, selectionCell } from '@tiptap/pm/tables'

export type TableSelectionKind = 'table' | 'cell' | 'cell-range' | 'row' | 'column'

export type TableBlockMetrics = {
  rows: number
  columns: number
  hasHeaderRow: boolean
  hasHeaderColumn: boolean
}

export type ActiveTableCellState = {
  isHeader: boolean
  row: number
  column: number
  rowSpan: number
  colSpan: number
  background: string | null
  textAlign: 'left' | 'center' | 'right' | 'justify' | null
  verticalAlign: 'top' | 'middle' | 'bottom' | null
  padding: number | null
  borderColor: string | null
  borderWidth: number | null
  borderStyle: string | null
}

function parseHorizontalAlign(value: unknown): ActiveTableCellState['textAlign'] {
  return value === 'left' || value === 'center' || value === 'right' || value === 'justify'
    ? value
    : null
}

function parseVerticalAlign(value: unknown): ActiveTableCellState['verticalAlign'] {
  return value === 'top' || value === 'middle' || value === 'bottom'
    ? value
    : null
}

export type TableSelectionInfo = TableBlockMetrics & {
  kind: TableSelectionKind
  selectedCellCount: number
  selectionWidth: number
  selectionHeight: number
  canMerge: boolean
  canSplit: boolean
  cell: ActiveTableCellState | null
}

function parseNumericStyleValue(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isHeaderCell(node: ProseMirrorNode | null | undefined) {
  return node?.type.spec.tableRole === 'header_cell'
}

function getTableMetricsFromNode(table: ProseMirrorNode): TableBlockMetrics {
  const map = TableMap.get(table)

  const firstRow = table.firstChild
  const hasHeaderRow = !!firstRow
    && firstRow.childCount > 0
    && Array.from({ length: firstRow.childCount }).every((_, index) => isHeaderCell(firstRow.child(index)))

  const hasHeaderColumn = table.childCount > 0
    && Array.from({ length: table.childCount }).every((_, rowIndex) => {
      const row = table.child(rowIndex)
      return row.childCount > 0 && isHeaderCell(row.firstChild)
    })

  return {
    rows: map.height,
    columns: map.width,
    hasHeaderRow,
    hasHeaderColumn,
  }
}

function getTableSelectionKind({
  rows,
  columns,
  selectionWidth,
  selectionHeight,
}: {
  rows: number
  columns: number
  selectionWidth: number
  selectionHeight: number
}): TableSelectionKind {
  if (selectionWidth >= columns && selectionHeight >= rows) {
    return 'table'
  }

  if (selectionWidth >= columns) {
    return 'row'
  }

  if (selectionHeight >= rows) {
    return 'column'
  }

  if (selectionWidth === 1 && selectionHeight === 1) {
    return 'cell'
  }

  return 'cell-range'
}

function getActiveCellState(cellNode: ProseMirrorNode | null | undefined, row: number, column: number): ActiveTableCellState | null {
  if (!cellNode) {
    return null
  }

  return {
    isHeader: isHeaderCell(cellNode),
    row,
    column,
    rowSpan: Math.max(1, Number(cellNode.attrs.rowspan ?? 1)),
    colSpan: Math.max(1, Number(cellNode.attrs.colspan ?? 1)),
    background: typeof cellNode.attrs.cellBackground === 'string' ? cellNode.attrs.cellBackground : null,
    textAlign: parseHorizontalAlign(cellNode.attrs.cellTextAlign),
    verticalAlign: parseVerticalAlign(cellNode.attrs.cellVerticalAlign),
    padding: parseNumericStyleValue(cellNode.attrs.cellPadding),
    borderColor: typeof cellNode.attrs.cellBorderColor === 'string' ? cellNode.attrs.cellBorderColor : null,
    borderWidth: parseNumericStyleValue(cellNode.attrs.cellBorderWidth),
    borderStyle: typeof cellNode.attrs.cellBorderStyle === 'string' ? cellNode.attrs.cellBorderStyle : null,
  }
}

export function getTableSelectionInfo(editor: Editor | null): TableSelectionInfo | null {
  if (!editor) {
    return null
  }

  const { state } = editor
  const { selection } = state

  if (selection instanceof NodeSelection && selection.node.type.spec.tableRole === 'table') {
    const metrics = getTableMetricsFromNode(selection.node)
    return {
      ...metrics,
      kind: 'table',
      selectedCellCount: metrics.rows * metrics.columns,
      selectionWidth: metrics.columns,
      selectionHeight: metrics.rows,
      canMerge: false,
      canSplit: false,
      cell: null,
    }
  }

  if (!isInTable(state)) {
    return null
  }

  const $cell = selectionCell(state)
  const table = $cell.node(-1)
  const tableStart = $cell.start(-1)
  const tableMetrics = getTableMetricsFromNode(table)
  const tableMap = TableMap.get(table)
  const activeRect = findCell($cell)
  const activeCell = $cell.nodeAfter

  let selectionWidth = activeRect.right - activeRect.left
  let selectionHeight = activeRect.bottom - activeRect.top
  let selectedCellCount = 1

  if (selection instanceof CellSelection) {
    const rect = tableMap.rectBetween(
      selection.$anchorCell.pos - tableStart,
      selection.$headCell.pos - tableStart,
    )
    selectionWidth = rect.right - rect.left
    selectionHeight = rect.bottom - rect.top
    selectedCellCount = tableMap.cellsInRect(rect).length
  }

  const cell = getActiveCellState(activeCell, activeRect.top + 1, activeRect.left + 1)
  const kind = getTableSelectionKind({
    rows: tableMetrics.rows,
    columns: tableMetrics.columns,
    selectionWidth,
    selectionHeight,
  })

  return {
    ...tableMetrics,
    kind,
    selectedCellCount,
    selectionWidth,
    selectionHeight,
    canMerge: selection instanceof CellSelection && selectedCellCount > 1,
    canSplit: !!cell && (cell.rowSpan > 1 || cell.colSpan > 1),
    cell,
  }
}

export function getTableBlockMetrics(content: string): TableBlockMetrics | null {
  if (typeof document === 'undefined') {
    return null
  }

  const container = document.createElement('div')
  container.innerHTML = content
  const table = container.querySelector('table')
  if (!table) {
    return null
  }

  const rows = Array.from(table.querySelectorAll('tr'))
  const rowCount = rows.length
  const columnCount = rows.reduce((max, row) => {
    const width = Array.from(row.children).reduce((sum, cell) => {
      const span = Number((cell as HTMLTableCellElement).colSpan || 1)
      return sum + Math.max(1, span)
    }, 0)
    return Math.max(max, width)
  }, 0)

  const firstRow = rows[0]
  const hasHeaderRow = !!firstRow
    && firstRow.children.length > 0
    && Array.from(firstRow.children).every((cell) => cell.tagName === 'TH')

  const hasHeaderColumn = rowCount > 0
    && rows.every((row) => row.firstElementChild?.tagName === 'TH')

  return {
    rows: rowCount,
    columns: columnCount,
    hasHeaderRow,
    hasHeaderColumn,
  }
}
