import { ArrowDownRight, ArrowUpRight, ChevronsUpDown, Inbox } from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";
import { formatMoney } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { categoryVisual } from "@/lib/categoryVisual";

type DashboardData = {
  incomeMinor: number;
  expenseMinor: number;
  balanceMinor: number;
  pendingCount: number;
  recent: Doc<"transactions">[];
  expenseByCategory: { categoryName: string; amountMinor: number }[];
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function monthLabel(date: Date) {
  return capitalize(new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(date));
}

function monthName(date: Date) {
  return new Intl.DateTimeFormat("es-CO", { month: "long" }).format(date);
}

export function Dashboard({ data, monthDate, onSelectMonth, onReview, onTransactions }: { data: DashboardData | undefined; name: string; monthDate: Date; onSelectMonth: (date: Date) => void; onReview: () => void; onTransactions: () => void }) {
  const income = data?.incomeMinor ?? 0;
  const expense = data?.expenseMinor ?? 0;
  const balance = data?.balanceMinor ?? 0;
  const recent = data?.recent ?? [];
  const expenseByCategory = data?.expenseByCategory ?? [];
  const categoryTotal = expenseByCategory.reduce((sum, item) => sum + item.amountMinor, 0);
  const pieSegments = expenseByCategory.map((item, index) => {
    const visual = categoryVisual(item.categoryName, "expense");
    const percent = categoryTotal > 0 ? item.amountMinor / categoryTotal : 0;
    return {
      ...item,
      color: visual.bg,
      percent,
      offset: expenseByCategory
        .slice(0, index)
        .reduce((sum, previous) => sum + (categoryTotal > 0 ? previous.amountMinor / categoryTotal : 0), 0),
    };
  });
  const pieGradient = pieSegments.length > 0
    ? `conic-gradient(${pieSegments.map((segment) => `${segment.color} ${segment.offset * 100}% ${(segment.offset + segment.percent) * 100}%`).join(", ")})`
    : undefined;

  const now = new Date();
  const monthOptions = Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - index, 1));

  const hasEntries = recent.length > 0;

  return (
    <div className="screen insights-screen">
      <header className="insights-header">
        <h1>Resumen</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="period-pill" type="button">{monthLabel(monthDate)} <ChevronsUpDown /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="month-menu">
            {monthOptions.map((option) => (
              <DropdownMenuItem key={option.toISOString()} onSelect={() => onSelectMonth(option)}>
                {monthLabel(option)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <section className="hero-card">
        <span className="hero-label">Balance de {monthName(monthDate)}</span>
        <strong className="hero-amount" data-sign={balance >= 0 ? "pos" : "neg"}>
          {formatMoney(balance, "COP", balance >= 0 ? "positive" : "negative")}
        </strong>
      </section>

      <section className="insights-cards">
        <button className="insight-card" type="button" onClick={onTransactions}>
          <span className="card-icon income"><ArrowUpRight /></span>
          <span><small>Ingresos</small><strong>{formatMoney(income)}</strong></span>
        </button>
        <button className="insight-card" type="button" onClick={onTransactions}>
          <span className="card-icon expense"><ArrowDownRight /></span>
          <span><small>Gastos</small><strong>{formatMoney(expense)}</strong></span>
        </button>
      </section>

      {(data?.pendingCount ?? 0) > 0 ? (
        <button className="review-banner" type="button" onClick={onReview}>
          <span className="card-icon expense">⚠️</span>
          <span><small>Por revisar</small><strong>{data?.pendingCount} movimiento(s)</strong></span>
          <span className="chevron">›</span>
        </button>
      ) : null}

      {hasEntries ? (
        <section className="chart-card">
          <span className="chart-title">Gastos por categoría</span>
          {pieSegments.length > 0 ? (
            <div className="expense-pie-layout">
              <div className="expense-pie" style={{ background: pieGradient }}>
                <span>{formatMoney(categoryTotal)}</span>
              </div>
              <div className="expense-pie-legend">
                {pieSegments.slice(0, 6).map((segment) => (
                  <div key={segment.categoryName}>
                    <span><i style={{ background: segment.color }} />{segment.categoryName}</span>
                    <strong>{formatMoney(segment.amountMinor)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="chart-empty">No hay gastos confirmados en {monthName(monthDate)}.</p>
          )}
        </section>
      ) : (
        <div className="insights-empty"><Inbox /><p>No hay movimientos en {monthName(monthDate)}.</p></div>
      )}
    </div>
  );
}
