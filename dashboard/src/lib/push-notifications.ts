"use client";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

/**
 * Check if push notifications are supported and permitted.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Request notification permission from the user.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied";
  return Notification.requestPermission();
}

/**
 * Subscribe to push notifications via the service worker.
 * Returns the PushSubscription or null if not possible.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const permission = await requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.ready;

  // Check existing subscription
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  // Create new subscription
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[push] No VAPID public key configured");
    return null;
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
  });

  return subscription;
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;

  return subscription.unsubscribe();
}

/**
 * Send a local notification (doesn't require push subscription).
 * Useful for real-time events received via Supabase Realtime.
 */
export async function showLocalNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (!isPushSupported()) return;

  const permission = await requestPermission();
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    ...options,
  });
}

/**
 * Show notification for specific agent events.
 */
export function notifyAgentEvent(
  eventType: string,
  data: Record<string, unknown>
): void {
  switch (eventType) {
    case "error":
      showLocalNotification("Agent Error", {
        body: String(data.message || "An error occurred"),
        tag: "agent-error",
      });
      break;
    case "payment":
      if (Number(data.amount) > 0.01) {
        showLocalNotification("Large Payment", {
          body: `$${Number(data.amount).toFixed(4)} USDC spent on ${data.service}`,
          tag: "agent-payment",
        });
      }
      break;
    case "status_change":
      if (data.new_status === "offline") {
        showLocalNotification("Agent Offline", {
          body: "Your OpenClaw agent has gone offline",
          tag: "agent-status",
        });
      }
      break;
  }
}

// Helper: Convert VAPID key for Web Push
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
