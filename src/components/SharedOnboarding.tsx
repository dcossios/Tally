import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, KeyRound, Plus, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "choose" | "create" | "join";

export function SharedOnboarding() {
  const createSpace = useMutation(api.shared.createSpace);
  const joinByCode = useMutation(api.shared.joinByCode);
  const [mode, setMode] = useState<Mode>("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = () => {
    setBusy(true);
    void createSpace({ name })
      .then(() => toast.success("Bolsillos creados. Invita a tu pareja."))
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setBusy(false));
  };

  const handleJoin = () => {
    if (!code.trim()) {
      toast.error("Ingresa el código.");
      return;
    }
    setBusy(true);
    void joinByCode({ code })
      .then(() => toast.success("¡Te uniste a sus bolsillos!"))
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setBusy(false));
  };

  return (
    <div className="screen shared-onboarding">
      <div className="shared-onboarding-hero">
        <h1>Bolsillos compartidos</h1>
        <p>Aporten cada mes al bolsillo común. Al cerrar el mes, todo lo que quede pasa al ahorro y el común vuelve a cero.</p>
      </div>

      <div className="pocket-preview">
        <div className="pocket-preview-card">
          <span className="pocket-icon common"><Wallet /></span>
          <strong>Bolsillo común</strong>
          <small>Los dos aportan aquí cada mes.</small>
        </div>
        <div className="pocket-preview-arrow"><ArrowDown /><span>al cerrar el mes</span></div>
        <div className="pocket-preview-card">
          <span className="pocket-icon savings"><Sparkles /></span>
          <strong>Ahorro compartido</strong>
          <small>Se acumula lo que sobra para sus metas.</small>
        </div>
      </div>

      {mode === "choose" ? (
        <div className="shared-onboarding-actions">
          <button className="shared-choice" type="button" onClick={() => setMode("create")}>
            <span className="shared-choice-icon"><Plus /></span>
            <span><strong>Crear nuestros bolsillos</strong><small>Se crean el común y el ahorro. Luego invitas a tu pareja.</small></span>
          </button>
          <button className="shared-choice" type="button" onClick={() => setMode("join")}>
            <span className="shared-choice-icon"><KeyRound /></span>
            <span><strong>Unirme con código</strong><small>Tu pareja ya los creó y te compartió un código.</small></span>
          </button>
        </div>
      ) : null}

      {mode === "create" ? (
        <form className="shared-onboarding-form" onSubmit={(event) => { event.preventDefault(); handleCreate(); }}>
          <label>Nombre (opcional)
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="David & Isabela" autoFocus />
          </label>
          <Button type="submit" disabled={busy}>Crear común y ahorro</Button>
          <button className="text-action" type="button" onClick={() => setMode("choose")}>Volver</button>
        </form>
      ) : null}

      {mode === "join" ? (
        <form className="shared-onboarding-form" onSubmit={(event) => { event.preventDefault(); handleJoin(); }}>
          <label>Código de invitación
            <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="SALDO-XXXXX" autoFocus autoCapitalize="characters" />
          </label>
          <Button type="submit" disabled={busy}>Unirme</Button>
          <button className="text-action" type="button" onClick={() => setMode("choose")}>Volver</button>
        </form>
      ) : null}
    </div>
  );
}
