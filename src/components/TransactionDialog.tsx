import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlignLeft, Check, Delete, LayoutGrid, Repeat, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { categoryVisual } from "@/lib/categoryVisual";
import { dateInputToBogota, toDateInput } from "@/lib/format";
import type { Doc } from "../../convex/_generated/dataModel";

type TxType = "expense" | "income";

function displayAmount(raw: string) {
  if (!raw) return "0";
  const [intPart, decPart] = raw.split(".");
  const intFmt = intPart ? Number(intPart).toLocaleString("es-CO") : "0";
  return decPart !== undefined ? `${intFmt},${decPart}` : intFmt;
}

function metaDateLabel(timestamp: number) {
  const today = toDateInput(Date.now()) === toDateInput(timestamp);
  const dayMonth = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" }).format(timestamp).replace(".", "");
  const time = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false }).format(timestamp);
  return { date: today ? `Hoy, ${dayMonth}` : dayMonth, time };
}

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  forceShowNote = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Doc<"transactions">;
  forceShowNote?: boolean;
}) {
  const create = useMutation(api.transactions.create);
  const update = useMutation(api.transactions.update);
  const remove = useMutation(api.transactions.remove);

  const [type, setType] = useState<TxType>("expense");
  const [raw, setRaw] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [categoryId, setCategoryId] = useState<Doc<"categories">["_id"] | undefined>(undefined);
  const [categoryName, setCategoryName] = useState<string | undefined>(undefined);
  const [showCategories, setShowCategories] = useState(false);
  const [occurredAt, setOccurredAt] = useState(Date.now());

  const categories = useQuery(api.categories.list, { kind: type });

  useEffect(() => {
    if (!open) return;
    setType(transaction?.type ?? "expense");
    setRaw(transaction ? String(Math.round(transaction.amountMinor / 100)) : "");
    setNote(transaction?.note ?? "");
    setShowNote(forceShowNote || Boolean(transaction?.note));
    setCategoryId(transaction?.categoryId);
    setCategoryName(transaction?.categoryName);
    setShowCategories(false);
    setOccurredAt(transaction?.occurredAt ?? Date.now());
  }, [forceShowNote, open, transaction]);

  const pushKey = (key: string) => {
    setRaw((current) => {
      if (key === ".") return current.includes(".") ? current : (current === "" ? "0." : current + ".");
      if (current.replace(".", "").length >= 12) return current;
      return current + key;
    });
  };

  const meta = metaDateLabel(occurredAt);

  const handleDelete = () => {
    if (!transaction) return;
    if (!window.confirm("¿Eliminar este movimiento? Esta acción no se puede deshacer.")) return;
    void remove({ id: transaction._id })
      .then(() => { toast.success("Movimiento eliminado."); onOpenChange(false); })
      .catch((error: Error) => toast.error(error.message));
  };

  const submit = () => {
    const value = parseFloat(raw || "0");
    if (!value || value <= 0) { toast.error("Ingresa un monto."); return; }
    const amountMinor = Math.round(value * 100);
    const resolvedName = categoryName ?? transaction?.categoryName ?? "Sin categoría";
    const merchant = transaction?.merchant
      ?? (resolvedName !== "Sin categoría" ? resolvedName : (type === "income" ? "Ingreso" : "Gasto"));
    const payload = {
      type,
      currency: transaction?.currency ?? ("COP" as const),
      amountMinor,
      amountCopMinor: transaction?.currency === "USD" ? transaction.amountCopMinor : amountMinor,
      merchant,
      categoryId,
      categoryName: resolvedName,
      occurredAt,
      accountLabel: transaction?.accountLabel,
      note: note.trim() || undefined,
    };
    const request = transaction ? update({ id: transaction._id, ...payload }) : create(payload);
    void request.then(() => {
      toast.success(transaction ? "Movimiento actualizado." : "Movimiento guardado.");
      onOpenChange(false);
    }).catch((error: Error) => toast.error(error.message));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="calc-dialog">
        <DialogTitle className="sr-only">{transaction ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
        <DialogDescription className="sr-only">
          Ingresa el monto, la categoría, la fecha y la nota opcional del movimiento.
        </DialogDescription>
        <div className="calc-inner">
          <div className="calc-topbar">
            <button className="calc-round-btn" type="button" aria-label="Cerrar" onClick={() => onOpenChange(false)}><X /></button>
            <div className="seg-toggle">
              <button type="button" data-state={type === "expense" ? "on" : "off"} onClick={() => { setType("expense"); setCategoryId(undefined); setCategoryName(undefined); }}>Gasto</button>
              <button type="button" data-state={type === "income" ? "on" : "off"} onClick={() => { setType("income"); setCategoryId(undefined); setCategoryName(undefined); }}>Ingreso</button>
            </div>
            {transaction ? (
              <button className="calc-round-btn danger" type="button" aria-label="Eliminar" onClick={handleDelete}><Trash2 /></button>
            ) : (
              <button className="calc-round-btn" type="button" aria-label="Cambiar tipo" onClick={() => { setType((current) => current === "expense" ? "income" : "expense"); setCategoryId(undefined); setCategoryName(undefined); }}><Repeat /></button>
            )}
          </div>

          <div className="calc-stage">
            <div className="calc-amount">
              <span className="currency">$</span>
              <span className={raw ? "" : "zero"}>{displayAmount(raw)}</span>
            </div>
            <button className="calc-backspace" type="button" aria-label="Borrar" onClick={() => setRaw((current) => current.slice(0, -1))}><Delete /></button>

            {showNote ? (
              <input className="note-input" autoFocus placeholder="Nota" value={note} onChange={(event) => setNote(event.target.value)} />
            ) : (
              <button className="add-note-pill" type="button" onClick={() => setShowNote(true)}><AlignLeft /> {note || "Añadir nota"}</button>
            )}

            {showCategories ? (
              <div className="calc-quick">
                {(categories ?? []).slice(0, 6).map((category) => {
                  const visual = categoryVisual(category.name, type);
                  return (
                    <button className="quick-chip" type="button" key={category._id} onClick={() => { setCategoryId(category._id); setCategoryName(category.name); setShowCategories(false); }}>
                      <span>{visual.emoji}</span> {category.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="calc-meta-row">
            <label className="meta-pill">
              <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                {meta.date}<span className="time">{meta.time}</span>
                <input
                  type="date"
                  defaultValue={toDateInput(occurredAt)}
                  onChange={(event) => event.target.value && setOccurredAt(dateInputToBogota(event.target.value))}
                  style={{ position: "absolute", inset: 0, opacity: 0, width: "100%" }}
                  aria-label="Fecha"
                />
              </span>
            </label>
            <button className="meta-pill category" type="button" data-selected={Boolean(categoryName)} onClick={() => setShowCategories((open) => !open)}>
              <LayoutGrid /> {categoryName ?? "Categoría"}
            </button>
          </div>

          {transaction ? (
            <button className="calc-delete" type="button" onClick={handleDelete}><Trash2 /> Eliminar movimiento</button>
          ) : null}

          <div className="keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
              <button className="key" type="button" key={key} onClick={() => pushKey(key)}>{key}</button>
            ))}
            <button className="key" type="button" onClick={() => pushKey(".")}>.</button>
            <button className="key" type="button" onClick={() => pushKey("0")}>0</button>
            <button className="key key-submit" type="button" aria-label="Guardar" onClick={submit}><Check /></button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
