import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { TransactionRow } from "./TransactionRow";
import { TransactionDialog } from "./TransactionDialog";
import { useState } from "react";
import type { Doc } from "../../convex/_generated/dataModel";

export function TransactionsScreen() {
  const { results, status, loadMore } = usePaginatedQuery(api.transactions.list, {}, { initialNumItems: 20 });
  const [selected, setSelected] = useState<Doc<"transactions"> | null>(null);
  return (
    <div className="screen standard-screen">
      <header className="screen-header"><p>Tu actividad</p><h1>Movimientos</h1></header>
      <div className="filter-row"><button data-active type="button">Todos</button><button type="button">Gastos</button><button type="button">Ingresos</button></div>
      <div className="transaction-list">{results.map((transaction) => <TransactionRow key={transaction._id} transaction={transaction} onClick={() => setSelected(transaction)} />)}</div>
      {status === "CanLoadMore" ? <Button variant="outline" onClick={() => loadMore(20)}>Cargar más</Button> : null}
      {results.length === 0 && status !== "LoadingFirstPage" ? <div className="empty-state"><h3>Sin movimientos</h3><p>Los registros aparecerán aquí.</p></div> : null}
      <TransactionDialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)} transaction={selected ?? undefined} />
    </div>
  );
}
