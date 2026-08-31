/* global self */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = {};
  }
  const url =
    typeof payload.url === "string" && payload.url.startsWith("/track/")
      ? payload.url
      : "/track";
  event.waitUntil(
    self.registration.showNotification("Pedido listo", {
      body: "Tu pedido está listo para retirar.",
      data: { url },
      icon: "/favicon.ico",
      tag: "toquetin-order-ready",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/track";
  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: "window" })
      .then(async (windows) => {
        for (const client of windows) {
          if (client.url === new URL(url, self.location.origin).href) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
