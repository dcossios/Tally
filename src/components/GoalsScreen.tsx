import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, Flag, PiggyBank, Plus, Target, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate, formatMoney, toDateInput } from "@/lib/format";
import type { Doc, Id } from "../../convex/_generated/dataModel";

type GoalKind = "saving" | "spendingLimit";
type GoalWithProgress = Doc<"goals"> & {
  currentMinor: number;
  ratio: number;
  remainingMinor: number;
};

const DAY = 24 * 60 * 60 * 1000;

export function GoalsScreen({ focusGoalId }: { focusGoalId?: Id<"goals"> | null }) {
  const goals = useQuery(api.goals.list);
  const archive = useMutation(api.goals.archive);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GoalWithProgress | null>(null);

  useEffect(() => {
    if (!focusGoalId || goals === undefined) return;
    const element = document.querySelector(`[data-goal-id="${focusGoalId}"]`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusGoalId, goals]);

  const activeGoals = goals ?? [];
  const spendingAlerts = activeGoals.filter((goal) => goal.kind === "spendingLimit" && goal.ratio >= 0.8).length;

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (goal: GoalWithProgress) => {
    setEditing(goal);
    setDialogOpen(true);
  };

  return (
    <div className="screen goals-screen">
      <header className="goals-header">
        <div>
          <p>Seguimiento personal</p>
          <h1>Metas</h1>
        </div>
        <button className="goals-add" type="button" aria-label="Crear meta" onClick={openCreate}><Plus /></button>
      </header>

      <section className="goals-summary">
        <div>
          <span><Target /></span>
          <small>Activas</small>
          <strong>{activeGoals.length}</strong>
        </div>
        <div>
          <span><Bell /></span>
          <small>En alerta</small>
          <strong>{spendingAlerts}</strong>
        </div>
      </section>

      <div className="goals-list">
        {activeGoals.map((goal) => (
          <GoalCard
            key={goal._id}
            goal={goal}
            focused={goal._id === focusGoalId}
            onEdit={() => openEdit(goal)}
            onArchive={() => {
              if (!window.confirm("¿Archivar esta meta?")) return;
              void archive({ id: goal._id })
                .then(() => toast.success("Meta archivada."))
                .catch((error: Error) => toast.error(error.message));
            }}
          />
        ))}
      </div>

      {activeGoals.length === 0 && goals !== undefined ? (
        <div className="empty-state">
          <span className="emoji">◎</span>
          <h3>Sin metas activas</h3>
          <p>Crea una meta de ahorro o un máximo de gasto para este periodo.</p>
          <Button onClick={openCreate}><Plus /> Crear meta</Button>
        </div>
      ) : null}

      <GoalDialog open={dialogOpen} onOpenChange={setDialogOpen} goal={editing} />
    </div>
  );
}

function GoalCard({
  goal,
  focused,
  onEdit,
  onArchive,
}: {
  goal: GoalWithProgress;
  focused: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const percent = Math.min(100, Math.round(goal.ratio * 100));
  const isLimit = goal.kind === "spendingLimit";
  const state = isLimit && goal.ratio >= 1 ? "danger" : isLimit && goal.ratio >= 0.8 ? "warn" : "ok";

  return (
    <article className="goal-card" data-state={state} data-focused={focused} data-goal-id={goal._id}>
      <button className="goal-card-main" type="button" onClick={onEdit}>
        <span className={`goal-icon ${isLimit ? "limit" : "saving"}`}>{isLimit ? <Flag /> : <PiggyBank />}</span>
        <span className="goal-info">
          <span className="goal-title-row">
            <strong>{goal.name}</strong>
            <em>{isLimit ? "Gasto" : "Ahorro"}</em>
            <span className="goal-percent">{percent}%</span>
          </span>
          <small>
            {goal.categoryName ? `${goal.categoryName} · ` : ""}
            {formatDate(goal.startAt)} - {formatDate(goal.endAt - DAY)}
          </small>
          <span className="goal-progress"><i style={{ width: `${percent}%` }} /></span>
          <span className="goal-money">
            <b>{formatMoney(goal.currentMinor)}</b>
            <small>de {formatMoney(goal.targetMinor)}</small>
          </span>
        </span>
      </button>
      <button className="goal-archive" type="button" aria-label="Archivar meta" onClick={onArchive}><Trash2 /></button>
    </article>
  );
}

function GoalDialog({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: GoalWithProgress | null;
}) {
  const create = useMutation(api.goals.create);
  const update = useMutation(api.goals.update);
  const categories = useQuery(api.categories.list, { kind: "expense" });
  const [kind, setKind] = useState<GoalKind>("spendingLimit");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(() => toDateInput(Date.now()));
  const [endDate, setEndDate] = useState(() => toDateInput(Date.now()));
  const [categoryId, setCategoryId] = useState<Id<"categories"> | "">("");

  useEffect(() => {
    if (!open) return;
    setKind(goal?.kind ?? "spendingLimit");
    setName(goal?.name ?? "");
    setAmount(goal ? String(Math.round(goal.targetMinor / 100)) : "");
    setStartDate(goal ? toDateInput(goal.startAt) : toDateInput(Date.now()));
    setEndDate(goal ? toDateInput(goal.endAt - DAY) : toDateInput(Date.now()));
    setCategoryId(goal?.categoryId ?? "");
  }, [goal, open]);

  const selectedCategory = useMemo(
    () => (categories ?? []).find((category) => category._id === categoryId),
    [categories, categoryId],
  );

  const submit = () => {
    const value = Number(amount.replace(/[^\d]/g, ""));
    if (!value || value <= 0) {
      toast.error("Ingresa un monto objetivo.");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Selecciona las fechas.");
      return;
    }

    const payload = {
      kind,
      name,
      targetMinor: Math.round(value * 100),
      startAt: startOfDayBogota(startDate),
      endAt: startOfDayBogota(endDate) + DAY,
      categoryId: kind === "spendingLimit" && categoryId ? categoryId : undefined,
      categoryName: kind === "spendingLimit" ? selectedCategory?.name : undefined,
    };
    const request = goal ? update({ id: goal._id, ...payload }) : create(payload);
    void request
      .then(() => {
        toast.success(goal ? "Meta actualizada." : "Meta creada.");
        onOpenChange(false);
      })
      .catch((error: Error) => toast.error(error.message));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="goal-dialog">
        <DialogTitle>{goal ? "Editar meta" : "Nueva meta"}</DialogTitle>
        <DialogDescription>Define el monto, el rango de fechas y la categoría si aplica.</DialogDescription>
        <button className="goal-close" type="button" aria-label="Cerrar" onClick={() => onOpenChange(false)}><X /></button>

        <div className="goal-kind-toggle">
          <button type="button" data-active={kind === "spendingLimit"} onClick={() => setKind("spendingLimit")}><Flag /> Máximo gasto</button>
          <button type="button" data-active={kind === "saving"} onClick={() => setKind("saving")}><PiggyBank /> Ahorro</button>
        </div>

        <label className="goal-field">
          <span>Nombre</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "saving" ? "Viaje, emergencia..." : "Restaurantes, junio..."} />
        </label>
        <label className="goal-field">
          <span>Monto objetivo</span>
          <Input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="500000" />
        </label>
        <div className="goal-date-grid">
          <label className="goal-field">
            <span>Desde</span>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="goal-field">
            <span>Hasta</span>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
        {kind === "spendingLimit" ? (
          <label className="goal-field">
            <span>Categoría</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value as Id<"categories"> | "")}>
              <option value="">Todas las categorías</option>
              {(categories ?? []).map((category) => (
                <option key={category._id} value={category._id}>{category.name}</option>
              ))}
            </select>
          </label>
        ) : null}

        <Button onClick={submit}>{goal ? "Guardar cambios" : "Crear meta"}</Button>
      </DialogContent>
    </Dialog>
  );
}

function startOfDayBogota(value: string) {
  return Date.parse(`${value}T00:00:00-05:00`);
}
