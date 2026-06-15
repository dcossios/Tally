import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Bell, Copy, ExternalLink, KeyRound, LogOut, Smartphone, Tags, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  getBrowserNotificationPermission,
  getSubscriptionDetails,
  isPushSupported,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "@/lib/pushNotifications";

const SENDERS = ["855-40852-86", "874-00", "857-84"];

export function SettingsScreen() {
  const { signOut } = useAuthActions();
  const tokens = useQuery(api.shortcutTokens.list);
  const createToken = useMutation(api.shortcutTokens.create);
  const revoke = useMutation(api.shortcutTokens.revoke);
  const seedDemo = useMutation(api.transactions.seedDemo);
  const categories = useQuery(api.categories.list, {});
  const createCategory = useMutation(api.categories.create);
  const pushSubscriptions = useQuery(api.pushSubscriptions.list);
  const savePushSubscription = useMutation(api.pushSubscriptions.upsert);
  const removePushSubscription = useMutation(api.pushSubscriptions.remove);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(getBrowserNotificationPermission);
  const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string;
  const pushPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined;
  const pushSupported = useMemo(() => isPushSupported(), []);

  useEffect(() => {
    setNotificationPermission(getBrowserNotificationPermission());
  }, []);

  const generateToken = async () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = `saldo_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    await createToken({ name: "iPhone principal", token });
    setNewToken(token);
    toast.success("Token creado. Guárdalo ahora.");
  };

  const enableNotifications = async () => {
    if (!pushPublicKey) {
      toast.error("Falta configurar Web Push en el backend.");
      return;
    }
    try {
      setPushBusy(true);
      const subscription = await subscribeToPushNotifications(pushPublicKey);
      const details = getSubscriptionDetails(subscription);
      await savePushSubscription(details);
      setNotificationPermission(getBrowserNotificationPermission());
      toast.success("Notificaciones activadas.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible activar las notificaciones.";
      toast.error(message);
      setNotificationPermission(getBrowserNotificationPermission());
    } finally {
      setPushBusy(false);
    }
  };

  const disableNotifications = async () => {
    try {
      setPushBusy(true);
      const subscription = await unsubscribeFromPushNotifications();
      if (subscription) {
        await removePushSubscription({ endpoint: subscription.endpoint });
      }
      setNotificationPermission(getBrowserNotificationPermission());
      toast.success("Notificaciones desactivadas en este dispositivo.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible desactivar las notificaciones.";
      toast.error(message);
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="screen settings-screen">
      <header className="screen-header"><p>Automatización y cuenta</p><h1>Ajustes</h1></header>
      <section className="settings-section">
        <div className="settings-title"><Bell /><div><h2>Notificaciones</h2><p>Recibe una alerta al guardar un movimiento importado por SMS.</p></div></div>
        {!pushSupported ? (
          <p>Este dispositivo no soporta Web Push.</p>
        ) : !pushPublicKey ? (
          <p>Configura <code>WEB_PUSH_PUBLIC_KEY</code>, <code>WEB_PUSH_PRIVATE_KEY</code> y opcionalmente <code>WEB_PUSH_SUBJECT</code> en Convex para habilitarlas.</p>
        ) : notificationPermission === "denied" ? (
          <p>Safari tiene las notificaciones bloqueadas para esta app. Debes reactivarlas desde los ajustes del iPhone.</p>
        ) : (
          <>
            <p>
              {notificationPermission === "granted" && (pushSubscriptions?.length ?? 0) > 0
                ? "Las notificaciones están activas en este dispositivo."
                : "Actívalas para abrir la transacción desde la alerta y añadir una nota."}
            </p>
            {notificationPermission === "granted" && (pushSubscriptions?.length ?? 0) > 0 ? (
              <Button variant="outline" onClick={() => void disableNotifications()} disabled={pushBusy}>Desactivar notificaciones</Button>
            ) : (
              <Button onClick={() => void enableNotifications()} disabled={pushBusy}>Activar notificaciones</Button>
            )}
          </>
        )}
      </section>
      <section className="settings-section">
        <div className="settings-title"><Smartphone /><div><h2>Shortcut de Messages</h2><p>Configura una automatización para cada remitente.</p></div></div>
        <ol className="shortcut-steps">
          <li>En Shortcuts, crea una automatización personal con el trigger <strong>Mensaje</strong>.</li>
          <li>Selecciona uno de estos remitentes: {SENDERS.join(", ")}.</li>
          <li>Añade “Obtener contenido de URL”, método POST, cuerpo JSON.</li>
          <li>Envía <code>sender</code>, <code>message</code> y <code>receivedAt</code> al endpoint.</li>
          <li>Agrega el header <code>Authorization: Bearer TOKEN</code> y activa ejecución inmediata.</li>
        </ol>
        <div className="endpoint-box">
          <small>Endpoint</small><code>{siteUrl}/api/import/sms</code>
          <button type="button" aria-label="Copiar endpoint" onClick={() => void navigator.clipboard.writeText(`${siteUrl}/api/import/sms`)}><Copy /></button>
        </div>
        <a className="apple-link" href="https://support.apple.com/guide/shortcuts/communication-triggers-apdd711f9dff/ios" target="_blank" rel="noreferrer">Guía oficial de Apple <ExternalLink /></a>
      </section>
      <section className="settings-section">
        <div className="settings-title"><Tags /><div><h2>Categorías</h2><p>Organiza tus movimientos con categorías propias.</p></div></div>
        <div className="category-list">{categories?.map((category) => <span key={category._id}><i style={{ background: category.color }} />{category.name}</span>)}</div>
        <form
          className="category-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void createCategory({
              name: String(form.get("name")),
              kind: String(form.get("kind")) as "expense" | "income",
              icon: "tag",
              color: String(form.get("kind")) === "income" ? "#0d9488" : "#ef4444",
            }).then(() => {
              event.currentTarget.reset();
              toast.success("Categoría creada.");
            }).catch((error: Error) => toast.error(error.message));
          }}
        >
          <Input name="name" placeholder="Nueva categoría" required />
          <select name="kind"><option value="expense">Gasto</option><option value="income">Ingreso</option></select>
          <Button type="submit" variant="outline">Añadir</Button>
        </form>
      </section>
      <section className="settings-section">
        <div className="settings-title"><KeyRound /><div><h2>Tokens de acceso</h2><p>Se guardan únicamente como hash y puedes revocarlos.</p></div></div>
        <Button onClick={() => void generateToken()}>Crear token para iPhone</Button>
        {newToken ? (
          <div className="token-reveal"><strong>Cópialo ahora; no volverá a mostrarse.</strong><code>{newToken}</code><Button variant="outline" onClick={() => void navigator.clipboard.writeText(newToken)}><Copy /> Copiar token</Button></div>
        ) : null}
        <div className="token-list">
          {tokens?.map((token) => (
            <div key={token._id}>
              <span><strong>{token.name}</strong><small>{token.prefix}••••••••</small></span>
              {token.revokedAt ? <em>Revocado</em> : <button type="button" aria-label="Revocar token" onClick={() => void revoke({ id: token._id })}><Trash2 /></button>}
            </div>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <h2>Datos de demostración</h2><p>Carga los cinco mensajes de ejemplo para validar el dashboard.</p>
        <Button variant="outline" onClick={() => void seedDemo().then((created) => created ? toast.success("Datos cargados.") : toast.info("Ya existen movimientos."))}>Cargar ejemplos</Button>
      </section>
      <section className="settings-section"><Button variant="outline" className="sign-out" onClick={() => void signOut()}><LogOut /> Cerrar sesión</Button></section>
    </div>
  );
}
