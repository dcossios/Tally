import { AlertCircle, Bell, CalendarDays, ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";
import { formatMoney } from "@/lib/format";
import { TransactionRow } from "./TransactionRow";

type DashboardData = {
  incomeMinor: number;
  expenseMinor: number;
  balanceMinor: number;
  pendingCount: number;
  recent: Doc<"transactions">[];
};

export function Dashboard({ data, name, onReview, onTransactions }: { data: DashboardData | undefined; name: string; onReview: () => void; onTransactions: () => void }) {
  return (
    <div className="screen dashboard-screen">
      <header className="mobile-header">
        <div>
          <div className="wordmark">Saldo</div>
          <div className="greeting"><span className="avatar">{name.slice(0, 1).toUpperCase()}</span><span>Hola, {name.split(" ")[0]}</span></div>
        </div>
        <button className="icon-button" type="button" aria-label="Notificaciones"><Bell /></button>
      </header>
      <button className="month-selector" type="button"><CalendarDays />Junio 2026<ChevronDown /></button>
      <section className="balance-section">
        <p>Balance del mes</p>
        <h1>{formatMoney(data?.balanceMinor ?? 0)}</h1>
        <BalanceChart />
      </section>
      <section className="summary-strip">
        <div><span className="summary-icon income"><TrendingUp /></span><span><small>Ingresos</small><strong>{formatMoney(data?.incomeMinor ?? 0)}</strong></span></div>
        <div><span className="summary-icon expense"><TrendingDown /></span><span><small>Gastos</small><strong>{formatMoney(data?.expenseMinor ?? 0)}</strong></span></div>
      </section>
      {(data?.pendingCount ?? 0) > 0 ? (
        <button className="review-alert" type="button" onClick={onReview}><AlertCircle /><strong>{data?.pendingCount} movimiento por revisar</strong><span>›</span></button>
      ) : null}
      <section className="recent-section">
        <div className="section-heading"><h2>Movimientos recientes</h2><button type="button" onClick={onTransactions}>Ver todos ›</button></div>
        <div className="transaction-list">
          {data?.recent.length ? data.recent.map((transaction) => <TransactionRow key={transaction._id} transaction={transaction} />) : (
            <div className="empty-state"><CalendarDays /><h3>Aún no hay movimientos</h3><p>Añade uno manualmente o configura el Shortcut.</p></div>
          )}
        </div>
      </section>
    </div>
  );
}

function BalanceChart() {
  return (
    <svg className="balance-chart" viewBox="0 0 640 190" role="img" aria-label="Evolución del balance durante junio">
      <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1260f5" stopOpacity=".16" /><stop offset="1" stopColor="#1260f5" stopOpacity="0" /></linearGradient></defs>
      <path d="M15 165 C80 150 100 140 150 132 S230 116 270 100 S320 95 350 52 S450 55 500 42 S570 36 625 28 L625 175 L15 175 Z" fill="url(#chartFill)" />
      <path d="M15 165 C80 150 100 140 150 132 S230 116 270 100 S320 95 350 52 S450 55 500 42 S570 36 625 28" fill="none" stroke="#1260f5" strokeWidth="5" strokeLinecap="round" />
      <circle cx="15" cy="165" r="7" fill="#1260f5" /><circle cx="625" cy="28" r="7" fill="#1260f5" />
      <line x1="15" y1="175" x2="625" y2="175" stroke="#dbe3f0" />
      <text x="15" y="188">1 jun</text><text x="295" y="188">15 jun</text><text x="575" y="188">30 jun</text>
    </svg>
  );
}
