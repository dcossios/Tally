type StoredPushSubscription = {
  endpoint: string;
  expirationTime?: number;
  auth: string;
  p256dh: string;
};

export function isPushSupported() {
  return (
    typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window
  );
}

export function getBrowserNotificationPermission(): NotificationPermission {
  if (!isPushSupported()) return "default";
  return Notification.permission;
}

export async function subscribeToPushNotifications(publicKey: string) {
  if (!isPushSupported()) {
    throw new Error("Este dispositivo no soporta Web Push.");
  }

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permiso de notificaciones no concedido.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return existing;
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export async function unsubscribeFromPushNotifications() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return null;
  await subscription.unsubscribe();
  return subscription;
}

export function getSubscriptionDetails(subscription: PushSubscription): StoredPushSubscription {
  const json = subscription.toJSON();
  const keys = json.keys;
  if (!keys?.auth || !keys.p256dh) {
    throw new Error("La suscripción push no trae las llaves requeridas.");
  }
  return {
    endpoint: subscription.endpoint,
    expirationTime: json.expirationTime ?? undefined,
    auth: keys.auth,
    p256dh: keys.p256dh,
  };
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
