import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Toaster } from "sonner";
import { api } from "../convex/_generated/api";
import { AuthScreen } from "@/components/AuthScreen";
import { BottomNav, type Screen } from "@/components/BottomNav";
import { Dashboard } from "@/components/Dashboard";
import { GoalsScreen } from "@/components/GoalsScreen";
import { SharedScreen } from "@/components/SharedScreen";
import { TransactionsScreen } from "@/components/TransactionsScreen";
import { ReviewScreen } from "@/components/ReviewScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { TransactionDialog } from "@/components/TransactionDialog";
import type { Doc, Id } from "../convex/_generated/dataModel";

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
type NotificationTarget = { transactionId: Id<"transactions">; forceShowNote: boolean };
type GoalTarget = { goalId: Id<"goals"> | null };

function readNotificationTarget(): NotificationTarget | null {
  const url = new URL(window.location.href);
  const transactionId = url.searchParams.get("transactionId");
  if (!transactionId) return null;
  return {
    transactionId: transactionId as Id<"transactions">,
    forceShowNote: url.searchParams.get("openNote") === "1",
  };
}

function readGoalTarget(): GoalTarget | null {
  const url = new URL(window.location.href);
  if (url.searchParams.get("screen") !== "goals") return null;
  return {
    goalId: (url.searchParams.get("goalId") as Id<"goals"> | null) ?? null,
  };
}

function clearNotificationTarget() {
  const url = new URL(window.location.href);
  url.searchParams.delete("transactionId");
  url.searchParams.delete("openNote");
  url.searchParams.delete("screen");
  url.searchParams.delete("goalId");
  window.history.replaceState({}, "", url);
}

function SaldoApp() {
  const initialGoalTarget = readGoalTarget();
  const [screen, setScreen] = useState<Screen>(initialGoalTarget ? "goals" : "home");
  const [homeTab, setHomeTab] = useState<HomeTab>("personal");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTransaction, setDialogTransaction] = useState<Doc<"transactions"> | null>(null);
  const [forceShowNote, setForceShowNote] = useState(false);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [notificationTarget, setNotificationTarget] = useState<NotificationTarget | null>(
    () => readNotificationTarget(),
  );
  const [goalTarget, setGoalTarget] = useState<GoalTarget | null>(() => initialGoalTarget);
  const viewer = useQuery(api.users.viewer);
  const ensureDefaults = useMutation(api.categories.ensureDefaults);
  const range = useMemo(() => monthRange(monthDate), [monthDate]);
  const dashboard = useQuery(api.transactions.dashboard, range);
  const notificationTransaction = useQuery(
    api.transactions.get,
    notificationTarget ? { id: notificationTarget.transactionId } : "skip",
  );

  useEffect(() => { void ensureDefaults(); }, [ensureDefaults]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [screen]);
  useEffect(() => {
    const syncTarget = () => {
      setNotificationTarget(readNotificationTarget());
      const nextGoalTarget = readGoalTarget();
      setGoalTarget(nextGoalTarget);
      if (nextGoalTarget) setScreen("goals");
    };
    window.addEventListener("popstate", syncTarget);
    return () => window.removeEventListener("popstate", syncTarget);
  }, []);
  useEffect(() => {
    if (!goalTarget) return;
    setScreen("goals");
    clearNotificationTarget();
  }, [goalTarget]);
  useEffect(() => {
    if (!notificationTarget) return;
    if (notificationTransaction === undefined) return;
    setScreen("transactions");
    setHomeTab("personal");
    if (notificationTransaction) {
      setDialogTransaction(notificationTransaction);
      setForceShowNote(notificationTarget.forceShowNote);
      setDialogOpen(true);
    }
    setNotificationTarget(null);
    clearNotificationTarget();
  }, [notificationTarget, notificationTransaction]);

  const openCreateDialog = () => {
    setDialogTransaction(null);
    setForceShowNote(false);
    setDialogOpen(true);
  };

  const openEditDialog = (transaction: Doc<"transactions">, options?: { forceShowNote?: boolean }) => {
    setDialogTransaction(transaction);
    setForceShowNote(options?.forceShowNote ?? false);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setDialogTransaction(null);
      setForceShowNote(false);
      clearNotificationTarget();
    }
  };

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
        {screen === "transactions" ? <TransactionsScreen onSelectTransaction={openEditDialog} /> : null}
        {screen === "goals" ? <GoalsScreen focusGoalId={goalTarget?.goalId} /> : null}
        {screen === "review" ? <ReviewScreen onBack={() => setScreen("home")} /> : null}
        {screen === "settings" ? <SettingsScreen /> : null}
      </main>
      <BottomNav screen={screen} onNavigate={setScreen} onAdd={openCreateDialog} />
      <TransactionDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        transaction={dialogTransaction ?? undefined}
        forceShowNote={forceShowNote}
      />
    </div>
  );
}
