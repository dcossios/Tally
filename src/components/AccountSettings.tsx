import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarX2, RotateCcw, Trash2, Wallet, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { dateInputToBogota, formatDate, formatMoney, toDateInput } from "@/lib/format";

// Muestra "1.250.000" mientras se escribe; guarda solo dígitos.
function formatDigits(digits: string) {
  if (!digits) return "";
  return new Intl.NumberFormat("es-CO").format(Number(digits));
}

function onlyDigits(value: string) {
  return value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "").slice(0, 13);
}

function startOfDayBogota(value: string) {
  return dateInputToBogota(value) - 12 * 60 * 60 * 1000;
}

function monthBounds(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const startAt = Date.parse(`${year}-${pad(monthIndex + 1)}-01T00:00:00-05:00`);
  const nextYear = monthIndex === 11 ? year + 1 : year;
  const nextMonth = monthIndex === 11 ? 1 : monthIndex + 2;
  const endAt = Date.parse(`${nextYear}-${pad(nextMonth)}-01T00:00:00-05:00`);
  return { startAt, endAt };
}

function monthTitle(month: string) {
  const { startAt } = monthBounds(month);
  const label = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    month: "long",
    year: "numeric",
  }).format(startAt);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function movementsLabel(count: number | undefined) {
  if (count === undefined) return "Contando movimientos…";
  if (count === 0) return "No hay movimientos para borrar.";
  if (count >= 1000) return "Se borrarán más de 1.000 movimientos.";
  return count === 1 ? "Se borrará 1 movimiento." : `Se borrarán ${count} movimientos.`;
}

export function OpeningBalanceSection() {
  const current = useQuery(api.account.getOpeningBalance);
  const save = useMutation(api.account.setOpeningBalance);
  const clear = useMutation(api.account.clearOpeningBalance);
  const [digits, setDigits] = useState("");
  const [date, setDate] = useState(() => toDateInput(Date.now()));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (current === undefined) return;
    if (current === null) {
      setEditing(true);
      return;
    }
    setDigits(String(Math.round(current.openingBalanceMinor / 100)));
    setDate(toDateInput(current.startAt));
  }, [current]);

  const submit = async () => {
    if (!digits) {
      toast.error("Ingresa cuánto dinero tienes en la cuenta.");
      return;
    }
    if (!date) {
      toast.error("Selecciona la fecha.");
      return;
    }
    // Si es hoy, cuenta desde este momento; si es otro día, desde el inicio de ese día.
    const today = toDateInput(Date.now());
    const startAt = date === today ? Date.now() : startOfDayBogota(date);
    if (startAt > Date.now()) {
      toast.error("La fecha no puede ser futura.");
      return;
    }
    try {
      setBusy(true);
      await save({ openingBalanceMinor: Number(digits) * 100, startAt });
      setEditing(false);
      toast.success("Saldo inicial guardado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await clear();
    setDigits("");
    setDate(toDateInput(Date.now()));
    setEditing(true);
    toast.success("Saldo inicial eliminado.");
  };

  return (
    <section className="settings-section" id="saldo-inicial">
      <div className="settings-title">
        <Wallet />
        <div>
          <h2>Saldo inicial</h2>
          <p>El dinero que tienes hoy en la cuenta. Tus ingresos y gastos se suman o restan desde aquí.</p>
        </div>
      </div>

      {current && !editing ? (
        <>
          <div className="opening-summary">
            <small>Saldo inicial</small>
            <strong>{formatMoney(current.openingBalanceMinor)}</strong>
            <span>Desde el {formatDate(current.startAt, true)}</span>
          </div>
          <div className="opening-actions">
            <Button variant="outline" onClick={() => setEditing(true)}>Cambiar</Button>
            <Button variant="outline" className="danger-text" onClick={() => void remove()}>Quitar</Button>
          </div>
        </>
      ) : (
        <>
          <label className="export-field">
            <span>¿Cuánto tienes en la cuenta?</span>
            <div className="money-input">
              <b>$</b>
              <Input
                inputMode="numeric"
                enterKeyHint="done"
                value={formatDigits(digits)}
                onChange={(event) => setDigits(onlyDigits(event.target.value))}
                placeholder="0"
              />
            </div>
          </label>
          <label className="export-field">
            <span>Desde</span>
            <Input type="date" value={date} max={toDateInput(Date.now())} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className="opening-actions">
            {current ? <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button> : null}
            <Button onClick={() => void submit()} disabled={busy}>{busy ? "Guardando..." : "Guardar saldo"}</Button>
          </div>
        </>
      )}
    </section>
  );
}

export function ResetSection() {
  const [mode, setMode] = useState<"month" | "all" | null>(null);
  return (
    <section className="settings-section">
      <div className="settings-title">
        <RotateCcw />
        <div>
          <h2>Reiniciar</h2>
          <p>Borra ingresos y gastos para empezar desde cero. No se puede deshacer.</p>
        </div>
      </div>
      <div className="reset-buttons">
        <Button variant="outline" onClick={() => setMode("month")}><CalendarX2 /> Reiniciar un mes</Button>
        <Button variant="outline" className="danger-text" onClick={() => setMode("all")}><Trash2 /> Borrar todo</Button>
      </div>
      <ResetMonthDialog open={mode === "month"} onOpenChange={(open) => setMode(open ? "month" : null)} />
      <ResetAllDialog open={mode === "all"} onOpenChange={(open) => setMode(open ? "all" : null)} />
    </section>
  );
}

function ResetMonthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const resetMonth = useMutation(api.account.resetMonth);
  const [month, setMonth] = useState(() => toDateInput(Date.now()).slice(0, 7));
  const [busy, setBusy] = useState(false);
  const bounds = month ? monthBounds(month) : null;
  const count = useQuery(api.account.countForReset, open && bounds ? bounds : "skip");

  useEffect(() => {
    if (open) setMonth(toDateInput(Date.now()).slice(0, 7));
  }, [open]);

  const confirm = async () => {
    if (!bounds) return;
    try {
      setBusy(true);
      await resetMonth(bounds);
      toast.success(`${monthTitle(month)} quedó en ceros.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo reiniciar el mes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="goal-dialog">
        <DialogTitle>Reiniciar un mes</DialogTitle>
        <DialogDescription>Se borran todos los ingresos y gastos del mes que elijas. Tu saldo inicial se mantiene.</DialogDescription>
        <button className="goal-close" type="button" aria-label="Cerrar" onClick={() => onOpenChange(false)}><X /></button>
        <label className="goal-field">
          <span>Mes</span>
          <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <p className="reset-count">{month ? movementsLabel(count) : "Selecciona un mes."}</p>
        <Button variant="destructive" onClick={() => void confirm()} disabled={busy || !bounds || count === 0}>
          {busy ? "Borrando..." : month ? `Borrar ${monthTitle(month)}` : "Borrar"}
        </Button>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
      </DialogContent>
    </Dialog>
  );
}

function ResetAllDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const resetAll = useMutation(api.account.resetAll);
  const count = useQuery(api.account.countForReset, open ? {} : "skip");
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setDigits("");
  }, [open]);

  const confirm = async () => {
    try {
      setBusy(true);
      await resetAll({ openingBalanceMinor: digits ? Number(digits) * 100 : undefined });
      toast.success(digits ? `Listo. Empiezas con ${formatMoney(Number(digits) * 100)}.` : "Listo. Todo quedó en ceros.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo borrar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="goal-dialog">
        <DialogTitle>Borrar todo</DialogTitle>
        <DialogDescription>Se borran todos tus ingresos y gastos de todos los meses. No se puede deshacer.</DialogDescription>
        <button className="goal-close" type="button" aria-label="Cerrar" onClick={() => onOpenChange(false)}><X /></button>
        <p className="reset-count">{movementsLabel(count)}</p>
        <label className="goal-field">
          <span>Empezar con este saldo (opcional)</span>
          <div className="money-input">
            <b>$</b>
            <Input
              inputMode="numeric"
              enterKeyHint="done"
              value={formatDigits(digits)}
              onChange={(event) => setDigits(onlyDigits(event.target.value))}
              placeholder="0"
            />
          </div>
          <small className="field-hint">Si lo dejas vacío, todo queda en $0.</small>
        </label>
        <Button variant="destructive" onClick={() => void confirm()} disabled={busy}>
          {busy ? "Borrando..." : "Sí, borrar todo"}
        </Button>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
      </DialogContent>
    </Dialog>
  );
}
