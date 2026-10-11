import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  headerKey: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
  className?: string;
};

export type DataTableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  renderCard?: (row: T) => ReactNode;
  emptyState?: ReactNode;
  loading?: boolean;
  className?: string;
};

/** Tabela no desktop e lista de cards no mobile. */
export const DataTable = <T,>({
  rows,
  columns,
  getRowKey,
  onRowClick,
  renderCard,
  emptyState,
  loading = false,
  className,
}: DataTableProps<T>) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) return <>{emptyState}</>;

  return (
    <div className={className}>
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="h-10 border-b border-border bg-muted/60">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    column.numeric && "text-right",
                    column.className,
                  )}
                >
                  {t(column.headerKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "h-11 border-b border-border transition-colors duration-100 last:border-0 hover:bg-muted/50",
                  onRowClick && "cursor-pointer",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-3 align-middle",
                      column.numeric && "text-right num font-medium",
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div
            key={getRowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              "rounded-lg border border-border bg-card p-3 shadow-xs transition-colors",
              onRowClick && "cursor-pointer active:bg-muted/50",
            )}
          >
            {renderCard ? (
              renderCard(row)
            ) : (
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {columns.map((column) => (
                  <div key={column.key} className="min-w-0">
                    <p className="text-xs text-muted-foreground">{t(column.headerKey)}</p>
                    <p className={cn("truncate text-sm", column.numeric && "num font-medium")}>
                      {column.render(row)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
