"use client";

import { useId, useState } from "react";
import { Download, Search, Table2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  cellText,
  downloadTableCsv,
  filterTableRows,
  type PageTable,
} from "@/lib/admin/page-tables";

type Props = {
  title: string;
  tables: readonly PageTable[];
  snapshotAt?: string;
  stale?: boolean;
};

/** UI gate only. Confidential sources must ALSO enforce authorization server-side. */
export function AdminPageDataTables(props: Props) {
  const { user, worldSupervisor, loading, roleLoading } = useAuth();
  if (!user || !worldSupervisor || loading || roleLoading) return null;
  return <PageDataTablesPanel key={user.id} {...props} />;
}

/** Presentation only: has no fetch, subscription, role bypass or private data access. */
export function PageDataTablesPanel({
  title,
  tables,
  snapshotAt,
  stale = false,
}: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(tables[0]?.id);
  const [query, setQuery] = useState("");
  const table = tables.find((item) => item.id === selectedId) ?? tables[0];
  const rows = table ? filterTableRows(table, query) : [];
  if (!table) return null;
  return (
    <div className="my-6 min-w-0">
      <Button
        type="button"
        variant="secondary"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((value) => !value)}
      >
        <Table2 size={16} />{" "}
        {open ? "Hide complete tables" : "View complete tables"}
      </Button>
      {open && (
        <section
          id={`${id}-panel`}
          aria-labelledby={`${id}-title`}
          className="mt-4 min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--accent)]">
                Admin / Complete data
              </p>
              <h3 id={`${id}-title`} className="mt-2 text-xl font-bold">
                {title}
              </h3>
              <p className="mt-2 text-xs text-[var(--ink-muted)]">
                {snapshotAt ? (
                  <>
                    Server snapshot:{" "}
                    <time dateTime={snapshotAt}>
                      {new Date(snapshotAt).toLocaleString()}
                    </time>
                    . Tables update with the live overview.
                  </>
                ) : (
                  "Source: the same directory data displayed on this page."
                )}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={stale || !table.rows.length}
              onClick={() => downloadTableCsv(table)}
            >
              <Download size={15} /> Download full CSV (
              {table.rows.length.toLocaleString()})
            </Button>
          </div>
          {stale && (
            <p role="alert" className="mt-4 text-sm text-[var(--red)]">
              The latest refresh failed. These tables may be out of date;
              download is disabled until a successful refresh.
            </p>
          )}
          <div
            className="mt-5 flex flex-wrap gap-2"
            role="group"
            aria-label="Choose data table"
          >
            {tables.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant="secondary"
                style={
                  item.id === table.id
                    ? {
                        backgroundColor: "var(--accent-soft)",
                        color: "var(--accent)",
                        borderColor: "var(--accent)",
                      }
                    : undefined
                }
                aria-pressed={item.id === table.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setQuery("");
                }}
              >
                {item.title} ({item.rows.length.toLocaleString()})
              </Button>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
            {table.description}
          </p>
          <label className="mt-4 flex max-w-xl items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 py-2">
            <Search size={16} className="shrink-0" />
            <span className="sr-only">Search complete table</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search all columns"
              className="min-w-0 w-full bg-transparent text-sm outline-none"
            />
          </label>
          <p role="status" className="my-3 text-xs text-[var(--ink-muted)]">
            Showing {rows.length.toLocaleString()} /{" "}
            {table.rows.length.toLocaleString()} rows. CSV always includes all{" "}
            {table.rows.length.toLocaleString()} rows and every column,
            regardless of search.
          </p>
          <div
            role="region"
            aria-label={`${table.title} table — scroll to view all columns`}
            tabIndex={0}
            className="max-h-[65vh] min-w-0 overflow-auto rounded-lg border border-[var(--line)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            <table className="w-full min-w-max border-collapse text-left text-xs">
              <caption className="sr-only">
                {title}: {table.title}. Complete table, {table.rows.length}{" "}
                rows.
              </caption>
              <thead className="sticky top-0 z-10 bg-[var(--surface-subtle)] text-[var(--ink)]">
                <tr>
                  {table.columns.map((column) => (
                    <th
                      scope="col"
                      key={column.key}
                      className="border-b border-[var(--line)] px-4 py-3 font-bold"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={index}
                    className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-subtle)]"
                  >
                    {table.columns.map((column) => (
                      <td
                        key={column.key}
                        className="max-w-96 whitespace-pre-wrap break-words px-4 py-3 align-top"
                      >
                        {cellText(row[column.key]) || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="p-5 text-sm text-[var(--ink-muted)]">
                {query
                  ? "No rows match your search."
                  : "No records in this snapshot."}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
