import { ArrowDownRight, ArrowUpRight, ChevronsUpDown, Inbox } from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";
import { formatMoney } from "@/lib/format";

type DashboardData = {
  incomeMinor: number;
  expenseMinor: number;
  balanceMinor: number;
  pendingCount: number;
  recent: Doc<"transactions">[];
};

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function splitMoney(value: string) {
  const match = value.match(/^[^\d]*/);
  const prefix = match ? match[0] : "";
  return { prefix, rest: value.slice(prefix.length) };
}

function Money({ value, className }: { value: string; className?: string }) {
  const { prefix, rest } = splitMoney(value);
  return <span className={className}><span className="sign">{prefix}</span>{rest}</span>;
}

function weekdayIndex(timestamp: number) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", weekday: "short" }).format(timestamp);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(name);
}

export function Dashboard({ data, onReview, onTransactions }: { data: DashboardData | undefined; name: string; onReview: () => void; onTransactions: () => void }) {
  const income = data?.incomeMinor ?? 0;
  const expense = data?.expenseMinor ?? 0;
  const recent = data?.recent ?? [];

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
        <button className="period-pill" type="button">Mes <ChevronsUpDown /></button>
      </header>

      <section className="insights-stats">
        <div>
          <div className="stat-label">Junio 2026</div>
          <Money className="stat-value" value={formatMoney(data?.balanceMinor ?? 0, "COP", (data?.balanceMinor ?? 0) >= 0 ? "positive" : "negative")} />
        </div>
        <div>
          <div className="stat-label">Ingreso/día</div>
          <Money className="stat-value" value={formatMoney(Math.round(income / 30))} />
        </div>
      </section>

      <section className="insights-cards">
        <button className="insight-card" data-active="true" type="button" onClick={onTransactions}>
          <span className="card-icon income"><ArrowUpRight /></span>
          <span><small>Ingresos</small><strong>{formatMoney(income)}</strong></span>
        </button>
        <button className="insight-card" type="button" onClick={onTransactions}>
          <span className="card-icon expense"><ArrowDownRight /></span>
          <span><small>Gastos</small><strong>{formatMoney(expense)}</strong></span>
        </button>
      </section>

      <section className="bar-chart">
        <div className="bar-chart-grid">
          <div className="bar-chart-axis"><span>{Math.round(maxBar / 100).toLocaleString("es-CO")}</span><span>0</span></div>
          <div className="bar-chart-bars">
            {dailyExpense.map((value, index) => (
              <div className="bar" data-kind="expense" key={index}>
                <span className="fill" style={{ height: `${hasEntries ? Math.max((value / maxBar) * 100, value > 0 ? 4 : 0) : 0}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="bar-chart-labels">{DAY_LABELS.map((label, index) => <span key={index}>{label}</span>)}</div>
      </section>

      {(data?.pendingCount ?? 0) > 0 ? (
        <button className="insight-card" style={{ marginTop: 22, width: "100%" }} type="button" onClick={onReview}>
          <span className="card-icon expense">⚠️</span>
          <span><small>Por revisar</small><strong>{data?.pendingCount} movimiento(s)</strong></span>
        </button>
      ) : null}

      {!hasEntries ? (
        <div className="insights-empty"><Inbox /><p>No hay movimientos.</p></div>
      ) : null}
    </div>
  );
}
