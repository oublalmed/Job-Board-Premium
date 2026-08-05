'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  /** Rendered in place of the table body when there are no rows. */
  emptyState?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  /** Number of skeleton rows to show while loading. */
  skeletonRows?: number;
}

/**
 * Generic, token-driven table built on TanStack Table. Handles sorting,
 * loading skeletons, and an empty state. Horizontally scrollable inside
 * its own container so wide tables never break the page layout.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  emptyState,
  onRowClick,
  skeletonRows = 6,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // useReactTable is TanStack Table's only entry point and returns
  // functions React Compiler can't memoize — an informational skip, not a
  // correctness issue (the component just renders un-memoized, as before
  // the compiler). No alternative API exists, so the warning is silenced.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full caption-bottom text-sm">
        <thead className="border-b border-border">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className="h-11 px-4 text-start align-middle text-xs font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' ? (
                          <ArrowUp className="size-3.5" />
                        ) : sorted === 'desc' ? (
                          <ArrowDown className="size-3.5" />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="border-b border-border/50 last:border-0">
                {columns.map((_col, ci) => (
                  <td key={ci} className="px-4 py-3">
                    <Skeleton className="h-5 w-full max-w-[160px]" />
                  </td>
                ))}
              </tr>
            ))}

          {!loading &&
            rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  'border-b border-border/50 transition-colors last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-muted/50',
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle text-foreground">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="p-0">
                {emptyState ?? (
                  <div className="p-12 text-center text-sm text-muted-foreground">
                    No results.
                  </div>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
