import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createCoreRowModel,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table'

/** Column display hints. Declared here so `columnDef.meta` is typed at every
 *  use site rather than being cast at each one. */
export interface ColumnMeta {
  align?: 'left' | 'right'
  /** A month column, so it can be hidden or styled as a group. */
  month?: boolean
  /** Draws a divider to its right, separating month pairs. */
  boundary?: boolean
}

/* TanStack Table v9 registers features explicitly rather than shipping
 * everything, so only what this table uses is bundled: sorting, global
 * filtering, pagination, and column visibility. Row models are registered
 * alongside their prerequisite feature. */
export const billingTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  columnVisibilityFeature,

  coreRowModel: createCoreRowModel(),
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),

  columnMeta: {} as ColumnMeta,
})

export type BillingTableFeatures = typeof billingTableFeatures
