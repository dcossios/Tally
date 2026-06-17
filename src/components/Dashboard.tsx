import { ArrowDownRight, ArrowUpRight, Bell, ChevronsUpDown, Inbox } from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";
import { formatMoney } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Paleta cohesiva y vívida para el donut; se asigna por orden de monto
// para que las categorías siempre tengan colores distintos y legibles en dark.
const CHART_COLORS = ["#5e9bff", "#30d158", "#ffb340", "#ff6f91", "#b07cf0", "#5ac8fa"];
const DONUT_RADIUS = 42;
const DONUT_CIRC = 2 * Math.PI * DONUT_RADIUS;

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
  // Ordena por monto y agrupa la cola en "Otros" para que el donut no se llene
  // de tajadas diminutas e ilegibles.
  const ranked = [...expenseByCategory].sort((a, b) => b.amountMinor - a.amountMinor);
  const TOP = 5;
  const visibleCategories = ranked.length > TOP + 1
    ? [
        ...ranked.slice(0, TOP),
        { categoryName: "Otros", amountMinor: ranked.slice(TOP).reduce((sum, item) => sum + item.amountMinor, 0) },
      ]
    : ranked;
  const categoryTotal = visibleCategories.reduce((sum, item) => sum + item.amountMinor, 0);
  let cumulative = 0;
  const pieSegments = visibleCategories.map((item, index) => {
    const percent = categoryTotal > 0 ? item.amountMinor / categoryTotal : 0;
    const segment = {
      ...item,
      color: index === TOP && visibleCategories.length === TOP + 1 ? "#8e8e93" : CHART_COLORS[index % CHART_COLORS.length],
      percent,
      dashOffset: -cumulative * DONUT_CIRC,
    };
    cumulative += percent;
    return segment;
  });
  const donutGap = pieSegments.length > 1 ? 2.5 : 0;

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

      <section className="hero-card" data-sign={balance >= 0 ? "pos" : "neg"}>
        <span className="hero-label">Balance de {monthName(monthDate)}</span>
        <strong className="hero-amount" data-sign={balance >= 0 ? "pos" : "neg"}>
          {formatMoney(balance, "COP", balance >= 0 ? "positive" : "negative")}
        </strong>
        <div className="hero-breakdown">
          <span><i className="dot-income" />Ingresos<b>{formatMoney(income)}</b></span>
          <span><i className="dot-expense" />Gastos<b>{formatMoney(expense)}</b></span>
        </div>
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
          <span className="card-icon expense"><Bell /></span>
          <span><small>Notificación</small><strong>{data?.pendingCount} movimiento(s) por aprobar</strong></span>
          <span className="chevron">›</span>
        </button>
      ) : null}

      {hasEntries ? (
        <section className="chart-card">
          <span className="chart-title">Gastos por categoría</span>
          {pieSegments.length > 0 ? (
            <div className="expense-pie-layout">
              <div className="expense-donut">
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle className="donut-track" cx="50" cy="50" r={DONUT_RADIUS} />
                  {pieSegments.map((segment) => {
                    const length = Math.max(segment.percent * DONUT_CIRC - donutGap, 0.001);
                    return (
                      <circle
                        key={segment.categoryName}
                        className="donut-seg"
                        cx="50"
                        cy="50"
                        r={DONUT_RADIUS}
                        stroke={segment.color}
                        strokeDasharray={`${length} ${DONUT_CIRC - length}`}
                        strokeDashoffset={segment.dashOffset}
                      />
                    );
                  })}
                </svg>
                <div className="donut-center">
                  <small>Total</small>
                  <strong>{formatMoney(categoryTotal)}</strong>
                </div>
              </div>
              <div className="expense-pie-legend">
                {pieSegments.map((segment) => (
                  <div key={segment.categoryName}>
                    <span><i style={{ background: segment.color }} />{segment.categoryName}</span>
                    <strong>{formatMoney(segment.amountMinor)}<em>{Math.round(segment.percent * 100)}%</em></strong>
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
