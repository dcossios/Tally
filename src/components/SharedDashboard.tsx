import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, Check, ChevronsUpDown, Copy, Lock, Minus, Plus, Sparkles, Wallet } from "lucide-react";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { formatMoney, periodOf } from "@/lib/format";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SharedEntryDialog, type SharedEntryMode } from "@/components/SharedEntryDialog";

type Member = { userId: Id<"users">; name: string; role: "owner" | "member" };

type SpaceInfo = {
  space: Doc<"sharedSpaces">;
  members: Member[];
  myRole: "owner" | "member";
  myUserId: Id<"users">;
  inviteCode: string | null;
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

const ENTRY_VISUAL: Record<Doc<"sharedEntries">["kind"], { emoji: string; bg: string }> = {
  contribution: { emoji: "➕", bg: "#1f7a4d" },
  expense: { emoji: "🍽️", bg: "#b3322b" },
  rollover: { emoji: "🐷", bg: "#9a7fd6" },
  savingsExpense: { emoji: "🏖️", bg: "#caa15a" },
};

export function SharedDashboard({
  info,
  monthDate,
  onSelectMonth,
}: {
  info: SpaceInfo;
  monthDate: Date;
  onSelectMonth: (date: Date) => void;
}) {
  const period = periodOf(monthDate);
  const data = useQuery(api.shared.getSpaceDashboard, { period });
  const { results, status, loadMore } = usePaginatedQuery(api.shared.listEntries, {}, { initialNumItems: 20 });
  const generateInvite = useMutation(api.shared.generateInvite);
  const closeMonth = useMutation(api.shared.closeMonth);

  const [dialogMode, setDialogMode] = useState<SharedEntryMode | null>(null);

  const now = new Date();
  const monthOptions = Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - index, 1));

  const members = data?.members ?? info.members;
  const memberName = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) map.set(m.userId, m.name);
    return (id: Id<"users"> | undefined) => (id ? map.get(id) ?? "Alguien" : "Alguien");
  }, [members]);

  const common = data?.commonBalanceMinor ?? 0;
  const savings = data?.savingsBalanceMinor ?? 0;
  const isClosed = data?.isClosed ?? false;
  const isComplete = info.members.length >= 2;

  const handleInvite = () => {
    void generateInvite()
      .then((code) => {
        void navigator.clipboard.writeText(code).catch(() => undefined);
        toast.success(`Código ${code} copiado.`);
      })
      .catch((error: Error) => toast.error(error.message));
  };

  const handleCopy = (code: string) => {
    void navigator.clipboard.writeText(code).catch(() => undefined);
    toast.success("Código copiado.");
  };

  const handleClose = () => {
    if (!window.confirm(`¿Cerrar ${monthName(monthDate)}? Todo lo que hay en el bolsillo común (${formatMoney(common)}) pasará al ahorro y el común quedará en cero.`)) return;
    void closeMonth({ period })
      .then((res) => toast.success(res.movedToSavingsMinor > 0 ? `Pasaron ${formatMoney(res.movedToSavingsMinor)} al ahorro.` : "Mes cerrado."))
      .catch((error: Error) => toast.error(error.message));
  };

  const entryLabel = (entry: Doc<"sharedEntries">) => {
    switch (entry.kind) {
      case "contribution": return `Aporte de ${memberName(entry.memberId)}`;
      case "rollover": return "Cierre de mes → ahorro";
      default: return entry.merchant ?? "Movimiento";
    }
  };

  const entryAmount = (entry: Doc<"sharedEntries">) => {
    if (entry.kind === "contribution") return formatMoney(entry.amountMinor, "COP", "positive");
    if (entry.kind === "rollover") return formatMoney(entry.amountMinor);
    return formatMoney(entry.amountMinor, "COP", "negative");
  };

  return (
    <div className="screen insights-screen">
      <header className="insights-header">
        <h1>Juntos</h1>
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

      {!isComplete ? (
        <div className="invite-banner">
          <div className="invite-banner-text">
            <strong>Invita a tu pareja</strong>
            <small>Comparte este código para que se una a sus bolsillos.</small>
          </div>
          {info.inviteCode ? (
            <button className="invite-code" type="button" onClick={() => handleCopy(info.inviteCode!)}>
              <code>{info.inviteCode}</code><Copy />
            </button>
          ) : (
            <button className="invite-generate" type="button" onClick={handleInvite}>Generar código</button>
          )}
        </div>
      ) : null}

      <div className="pocket-stack">
        {/* Bolsillo común */}
        <section className="pocket-hero">
          <div className="pocket-hero-top">
            <span className="pocket-icon common"><Wallet /></span>
            <span className="pocket-hero-label">Bolsillo común</span>
          </div>
          <strong className="pocket-hero-amount" data-sign={common >= 0 ? "pos" : "neg"}>
            {formatMoney(common, "COP", common < 0 ? "negative" : undefined)}
          </strong>

          <span className="pocket-sub">Aportes de {monthName(monthDate)}</span>
          <div className="pocket-members">
            {members.map((member) => {
              const amount = data?.contributionsByMember?.[member.userId] ?? 0;
              return (
                <div className="pocket-member" key={member.userId}>
                  <span className="member-avatar">{member.name.charAt(0).toUpperCase()}</span>
                  <div>
                    <small>{member.name}{member.userId === info.myUserId ? " (tú)" : ""}</small>
                    <b>{formatMoney(amount)}</b>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pocket-buttons">
            <button className="pb-primary" type="button" onClick={() => setDialogMode("contribution")}><Plus /> Aportar</button>
            <button className="pb-secondary" type="button" onClick={() => setDialogMode("expense")}><Minus /> Salida</button>
          </div>
        </section>

        {/* Flujo común -> ahorro */}
        <div className="pocket-flow"><ArrowDown /><span>Al cerrar el mes, todo el común pasa al ahorro</span></div>

        {/* Ahorro compartido */}
        <section className="pocket-mini">
          <span className="pocket-icon savings"><Sparkles /></span>
          <div className="pocket-mini-main">
            <small>Ahorro compartido</small>
            <strong>{formatMoney(savings)}</strong>
          </div>
          <button className="pocket-mini-action" type="button" onClick={() => setDialogMode("savingsExpense")}>Retirar</button>
        </section>
      </div>

      {isClosed ? (
        <div className="closed-chip"><Check /> {capitalize(monthName(monthDate))} cerrado</div>
      ) : (
        <button className="close-month-btn" type="button" onClick={handleClose} disabled={common <= 0}>
          <Lock />
          {common > 0 ? `Cerrar mes · pasar ${formatMoney(common)} al ahorro` : "Cerrar mes (sin saldo en el común)"}
        </button>
      )}

      <section className="shared-list">
        <span className="chart-title">Movimientos</span>
        {results.length === 0 && status !== "LoadingFirstPage" ? (
          <div className="insights-empty"><Wallet /><p>Aún no hay movimientos compartidos.</p></div>
        ) : (
          results.map((entry) => {
            const visual = ENTRY_VISUAL[entry.kind];
            return (
              <div className="tx-row shared-row" key={entry._id}>
                <span className="cat-icon" style={{ background: visual.bg }}>{visual.emoji}</span>
                <span className="tx-main">
                  <strong>{entryLabel(entry)}</strong>
                  <small>{entry.note ?? entry.period}</small>
                </span>
                <span className="tx-amount" data-type={entry.kind === "contribution" ? "income" : "expense"}>
                  {entryAmount(entry)}
                </span>
              </div>
            );
          })
        )}
        {status === "CanLoadMore" ? <button className="load-more" type="button" onClick={() => loadMore(20)}>Cargar más</button> : null}
      </section>

      <SharedEntryDialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)} mode={dialogMode ?? "contribution"} />
    </div>
  );
}
