import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";
import { api } from "../convex/_generated/api";
import { AuthScreen } from "@/components/AuthScreen";
import { BottomNav, type Screen } from "@/components/BottomNav";
import { Dashboard } from "@/components/Dashboard";
import { TransactionsScreen } from "@/components/TransactionsScreen";
import { ReviewScreen } from "@/components/ReviewScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { TransactionDialog } from "@/components/TransactionDialog";

export default function App() {
  return <><Authenticated><SaldoApp /></Authenticated><Unauthenticated><AuthScreen /></Unauthenticated><Toaster position="top-center" richColors /></>;
}

function SaldoApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [dialogOpen, setDialogOpen] = useState(false);
  const viewer = useQuery(api.users.viewer);
  const ensureDefaults = useMutation(api.categories.ensureDefaults);
  const juneRange = useMemo(() => ({ monthStart: Date.parse("2026-06-01T00:00:00-05:00"), monthEnd: Date.parse("2026-07-01T00:00:00-05:00") }), []);
  const dashboard = useQuery(api.transactions.dashboard, juneRange);

  useEffect(() => { void ensureDefaults(); }, [ensureDefaults]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [screen]);

  return (
    <div className="app-shell">
      <main className="app-content">
        {screen === "home" ? <Dashboard data={dashboard} name={viewer?.name ?? "David"} onReview={() => setScreen("review")} onTransactions={() => setScreen("transactions")} /> : null}
        {screen === "transactions" ? <TransactionsScreen /> : null}
        {screen === "review" ? <ReviewScreen onBack={() => setScreen("home")} /> : null}
        {screen === "settings" ? <SettingsScreen /> : null}
      </main>
      {screen !== "review" ? <BottomNav screen={screen} pendingCount={dashboard?.pendingCount ?? 0} onNavigate={setScreen} onAdd={() => setDialogOpen(true)} /> : null}
      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
