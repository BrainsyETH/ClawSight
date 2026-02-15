"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-notifications";

interface PushState {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  loading: boolean;
  toggle: () => Promise<void>;
}

/**
 * Hook for managing push notification subscriptions.
 */
export function usePushNotifications(): PushState {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isSupported = isPushSupported();
    setSupported(isSupported);

    if (!isSupported) return;

    setPermission(Notification.permission);

    // Check existing subscription
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, []);

  const toggle = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        const sub = await subscribeToPush();
        setSubscribed(!!sub);
        if (sub) {
          setPermission("granted");
        } else {
          setPermission(Notification.permission);
        }
      }
    } catch (err) {
      console.error("[push] Toggle failed:", err);
    } finally {
      setLoading(false);
    }
  }, [supported, subscribed]);

  return { supported, permission, subscribed, loading, toggle };
}
