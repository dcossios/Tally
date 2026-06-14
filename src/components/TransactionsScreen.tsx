import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TransactionRow } from "./TransactionRow";
import { TransactionDialog } from "./TransactionDialog";
import { useMemo, useState } from "react";
import { ListFilter, Search } from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";
import { formatMoney, toDateInput } from "@/lib/format";

type Filter = "all" | "expense" | "income";
const FILTER_LABELS: Record<Filter, string> = { all: "Todos", expense: "Gastos", income: "Ingresos" };

function dayLabel(timestamp: number) {
  const weekday = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "short" }).format(timestamp).replace(".", "");
  const dayMonth = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" }).format(timestamp).replace(".", "");
  return `${weekday}, ${dayMonth}`.toUpperCase();
}

function signedMoney(minor: number) {
  return formatMoney(minor, "COP", minor >= 0 ? "positive" : "negative");
}

export function TransactionsScreen() {
  const { results, status, loadMore } = usePaginatedQuery(api.transactions.list, {}, { initialNumItems: 30 });
  const [selected, setSelected] = useState<Doc<"transactions"> | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => results.filter((tx) => {
    if (filter !== "all" && tx.type !== filter) return false;
    if (search && !tx.merchant.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [results, filter, search]);

  const netTotal = useMemo(() => filtered.reduce((sum, tx) => sum + (tx.type === "income" ? 1 : -1) * (tx.amountCopMinor ?? tx.amountMinor), 0), [filtered]);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; total: number; items: Doc<"transactions">[] }>();
    for (const tx of filtered) {
      const key = toDateInput(tx.occurredAt);
      const group = map.get(key) ?? { label: dayLabel(tx.occurredAt), total: 0, items: [] };
      group.total += (tx.type === "income" ? 1 : -1) * (tx.amountCopMinor ?? tx.amountMinor);
      group.items.push(tx);
      map.set(key, group);
    }
    return [...map.values()];
  }, [filtered]);

  return (
    <div className="screen tx-screen">
      <div className="tx-topbar">
        <button className="tx-icon-btn" type="button" aria-label="Buscar" onClick={() => { setSearchOpen((open) => !open); setSearch(""); }}><Search /></button>
        <button className="tx-icon-btn" type="button" aria-label="Filtrar" onClick={() => setFilter((current) => current === "all" ? "expense" : current === "expense" ? "income" : "all")}><ListFilter /></button>
      </div>

      <div className="net-total">
        <span className="net-total-label">Balance <span className="net-total-chip">esta vista</span></span>
        <h1>{(() => { const text = signedMoney(netTotal); const prefix = text.match(/^[^\d]*/)?.[0] ?? ""; return <><span className="sign">{prefix}</span>{text.slice(prefix.length)}</>; })()}</h1>
      </div>

      {searchOpen ? (
        <input className="note-input" style={{ width: "100%", marginBottom: 14 }} autoFocus placeholder="Buscar movimiento" value={search} onChange={(event) => setSearch(event.target.value)} />
      ) : null}

      <div className="tx-filter">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((key) => (
          <button key={key} type="button" data-active={filter === key} onClick={() => setFilter(key)}>{FILTER_LABELS[key]}</button>
        ))}
      </div>

      {groups.map((group) => (
        <div className="tx-group" key={group.label}>
          <div className="tx-date-header"><span>{group.label}</span><b>{signedMoney(group.total)}</b></div>
          {group.items.map((transaction) => <TransactionRow key={transaction._id} transaction={transaction} onClick={() => setSelected(transaction)} />)}
        </div>
      ))}

      {status === "CanLoadMore" ? <button className="load-more" type="button" onClick={() => loadMore(30)}>Cargar más</button> : null}

      {filtered.length === 0 && status !== "LoadingFirstPage" ? (
        <div className="empty-state"><span className="emoji">🙈</span><h3>Sin movimientos</h3><p>Los registros aparecerán aquí.</p></div>
      ) : null}

      <TransactionDialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)} transaction={selected ?? undefined} />
    </div>
  );
}
