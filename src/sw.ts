/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<unknown>;
};

clientsClaim();
void self.skipWaiting();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

self.addEventListener("push", (event) => {
  const payload = readPayload(event);
  if (!payload) return;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      data: {
        url: payload.url,
        transactionId: payload.transactionId,
        goalId: payload.goalId,
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const url = event.notification.data?.url;
  event.notification.close();
  if (!url) return;

  event.waitUntil(openOrFocus(url));
});

function readPayload(event: PushEvent) {
  try {
    return event.data?.json() as {
      title: string;
      body: string;
      url: string;
    transactionId: string;
    goalId?: string;
  };
  } catch {
    return null;
  }
}

async function openOrFocus(url: string) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of clients) {
    if ("focus" in client) {
      await client.focus();
      if ("navigate" in client) {
        await client.navigate(url);
      }
      return;
    }
  }

  await self.clients.openWindow(url);
}
