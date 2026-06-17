import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlignLeft, Check, Delete, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type SharedEntryMode = "contribution" | "expense" | "savingsExpense";

const TITLES: Record<SharedEntryMode, string> = {
  contribution: "Aportar al común",
  expense: "Salida compartida",
  savingsExpense: "Retirar del ahorro",
};

const NOTE_PLACEHOLDER: Record<SharedEntryMode, string> = {
  contribution: "Nota (opcional)",
  expense: "¿En qué? (ej: Cena)",
  savingsExpense: "¿Para qué? (opcional)",
};

function displayAmount(raw: string) {
  if (!raw) return "0";
  const [intPart, decPart] = raw.split(".");
  const intFmt = intPart ? Number(intPart).toLocaleString("es-CO") : "0";
  return decPart !== undefined ? `${intFmt},${decPart}` : intFmt;
}

export function SharedEntryDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: SharedEntryMode;
}) {
  const contribute = useMutation(api.shared.contribute);
  const addSharedExpense = useMutation(api.shared.addSharedExpense);
  const withdrawSavings = useMutation(api.shared.withdrawSavings);

  const [raw, setRaw] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRaw("");
    setNote("");
    setShowNote(mode === "expense");
  }, [open, mode]);

  const pushKey = (key: string) => {
    setRaw((current) => {
      if (key === ".") return current.includes(".") ? current : current === "" ? "0." : current + ".";
      if (current.replace(".", "").length >= 12) return current;
      return current + key;
    });
  };

  const submit = () => {
    const value = parseFloat(raw || "0");
    if (!value || value <= 0) {
      toast.error("Ingresa un monto.");
      return;
    }
    const amountMinor = Math.round(value * 100);
    const trimmed = note.trim();
    let request: Promise<unknown>;
    if (mode === "contribution") {
      request = contribute({ amountMinor, note: trimmed || undefined });
    } else if (mode === "expense") {
      request = addSharedExpense({ amountMinor, merchant: trimmed || "Salida" });
    } else {
      request = withdrawSavings({ amountMinor, note: trimmed || undefined });
    }
    void request
      .then(() => {
        toast.success(
          mode === "contribution"
            ? "Aporte registrado."
            : mode === "expense"
              ? "Salida registrada."
              : "Retiro registrado.",
        );
        onOpenChange(false);
      })
      .catch((error: Error) => toast.error(error.message));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="calc-dialog">
        <DialogTitle className="sr-only">{TITLES[mode]}</DialogTitle>
        <DialogDescription className="sr-only">
          Ingresa el monto y una nota opcional para registrar el movimiento compartido.
        </DialogDescription>
        <div className="calc-inner">
          <div className="calc-topbar">
            <button className="calc-round-btn" type="button" aria-label="Cerrar" onClick={() => onOpenChange(false)}><X /></button>
            <span className="calc-mode-title">{TITLES[mode]}</span>
            <span aria-hidden="true" />
          </div>

          <div className="calc-stage">
            <div className="calc-amount">
              <span className="currency">$</span>
              <span className={raw ? "" : "zero"}>{displayAmount(raw)}</span>
            </div>
            <button className="calc-backspace" type="button" aria-label="Borrar" onClick={() => setRaw((current) => current.slice(0, -1))}><Delete /></button>

            {showNote ? (
              <input className="note-input" autoFocus placeholder={NOTE_PLACEHOLDER[mode]} value={note} onChange={(event) => setNote(event.target.value)} />
            ) : (
              <button className="add-note-pill" type="button" onClick={() => setShowNote(true)}><AlignLeft /> {note || "Añadir nota"}</button>
            )}
          </div>

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
