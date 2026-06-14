import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";
import { api } from "../convex/_generated/api";
import { AuthScreen } from "@/components/AuthScreen";
import { BottomNav, type Screen } from "@/components/BottomNav";
import { Dashboard } from "@/components/Dashboard";
import { SharedScreen } from "@/components/SharedScreen";
import { TransactionsScreen } from "@/components/TransactionsScreen";
import { ReviewScreen } from "@/components/ReviewScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { TransactionDialog } from "@/components/TransactionDialog";

export default function App() {
  return <><Authenticated><SaldoApp /></Authenticated><Unauthenticated><AuthScreen /></Unauthenticated><Toaster position="top-center" richColors /></>;
}

function monthRange(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const pad = (value: number) => String(value + 1).padStart(2, "0");
  const monthStart = Date.parse(`${year}-${pad(month)}-01T00:00:00-05:00`);
  const nextYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const monthEnd = Date.parse(`${nextYear}-${pad(nextMonth)}-01T00:00:00-05:00`);
  return { monthStart, monthEnd };
}

type HomeTab = "personal" | "shared";

function SaldoApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [homeTab, setHomeTab] = useState<HomeTab>("personal");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const viewer = useQuery(api.users.viewer);
  const ensureDefaults = useMutation(api.categories.ensureDefaults);
  const range = useMemo(() => monthRange(monthDate), [monthDate]);
  const dashboard = useQuery(api.transactions.dashboard, range);

  useEffect(() => { void ensureDefaults(); }, [ensureDefaults]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [screen]);

  return (
    <div className="app-shell">
      <main className="app-content">
        {screen === "home" ? (
          <>
            <div className="home-tabs">
              <button type="button" data-active={homeTab === "personal"} onClick={() => setHomeTab("personal")}>Personal</button>
              <button type="button" data-active={homeTab === "shared"} onClick={() => setHomeTab("shared")}>Juntos</button>
            </div>
            {homeTab === "personal"
              ? <Dashboard data={dashboard} name={viewer?.name ?? "David"} monthDate={monthDate} onSelectMonth={setMonthDate} onReview={() => setScreen("review")} onTransactions={() => setScreen("transactions")} />
              : <SharedScreen monthDate={monthDate} onSelectMonth={setMonthDate} />}
          </>
        ) : null}
        {screen === "transactions" ? <TransactionsScreen /> : null}
        {screen === "review" ? <ReviewScreen onBack={() => setScreen("home")} /> : null}
        {screen === "settings" ? <SettingsScreen /> : null}
      </main>
      <BottomNav screen={screen} pendingCount={dashboard?.pendingCount ?? 0} onNavigate={setScreen} onAdd={() => setDialogOpen(true)} />
      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
