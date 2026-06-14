import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletCards } from "lucide-react";

export function AuthScreen() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [busy, setBusy] = useState(false);

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-lockup">
          <span className="brand-mark"><WalletCards /></span>
          <span>Saldo</span>
        </div>
        <div className="auth-copy">
          <h1>Tu dinero, al día sin acordarte de llenarlo.</h1>
          <p>Importa los mensajes de Bancolombia y revisa tus ingresos y gastos desde un solo lugar.</p>
        </div>
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            const formData = new FormData(event.currentTarget);
            formData.set("flow", flow);
            void signIn("password", formData)
              .catch((error: Error) => toast.error(error.message))
              .finally(() => setBusy(false));
          }}
        >
          {flow === "signUp" ? (
            <label>Nombre<Input name="name" autoComplete="name" defaultValue="David" required /></label>
          ) : null}
          <label>Correo<Input name="email" type="email" autoComplete="email" required /></label>
          <label>
            Contraseña
            <Input name="password" type="password" autoComplete={flow === "signIn" ? "current-password" : "new-password"} minLength={8} required />
          </label>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "Procesando…" : flow === "signIn" ? "Entrar" : "Crear cuenta"}
          </Button>
        </form>
        <button className="text-action" type="button" onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}>
          {flow === "signIn" ? "¿Primera vez? Crea tu cuenta" : "Ya tengo una cuenta"}
        </button>
      </section>
    </main>
  );
}
