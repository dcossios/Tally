import { ArrowDownRight, ArrowUpRight, ChevronsUpDown, Inbox } from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";
import { formatMoney } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type DashboardData = {
  incomeMinor: number;
  expenseMinor: number;
  balanceMinor: number;
  pendingCount: number;
  recent: Doc<"transactions">[];
};

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function monthLabel(date: Date) {
  return capitalize(new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(date));
}

function monthName(date: Date) {
  return new Intl.DateTimeFormat("es-CO", { month: "long" }).format(date);
}

function weekdayIndex(timestamp: number) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", weekday: "short" }).format(timestamp);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(name);
}

export function Dashboard({ data, monthDate, onSelectMonth, onReview, onTransactions }: { data: DashboardData | undefined; name: string; monthDate: Date; onSelectMonth: (date: Date) => void; onReview: () => void; onTransactions: () => void }) {
  const income = data?.incomeMinor ?? 0;
  const expense = data?.expenseMinor ?? 0;
  const balance = data?.balanceMinor ?? 0;
  const recent = data?.recent ?? [];

  const now = new Date();
  const monthOptions = Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - index, 1));

  const dailyExpense = new Array(7).fill(0) as number[];
  for (const tx of recent) {
    if (tx.type !== "expense") continue;
    const idx = weekdayIndex(tx.occurredAt);
    if (idx >= 0) dailyExpense[idx] += tx.amountCopMinor ?? tx.amountMinor;
  }
  const maxBar = Math.max(...dailyExpense, 1);
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
          <span className="chart-title">Gastos por día</span>
          <div className="bar-chart-bars">
            {dailyExpense.map((value, index) => (
              <div className="bar" data-kind="expense" key={index}>
                <span className="fill" style={{ height: `${Math.max((value / maxBar) * 100, value > 0 ? 6 : 0)}%` }} />
              </div>
            ))}
          </div>
          <div className="bar-chart-labels">{DAY_LABELS.map((label, index) => <span key={index}>{label}</span>)}</div>
        </section>
      ) : (
        <div className="insights-empty"><Inbox /><p>No hay movimientos en {monthName(monthDate)}.</p></div>
      )}
    </div>
  );
}
