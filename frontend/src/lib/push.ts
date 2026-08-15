// Emergent managed push notifications — client helpers.
//
// Déclic is a pass-and-play game with no accounts, so we mint a stable
// per-device id on first launch and use it as the `user_id`. The backend
// relay resolves the native token internally; we never store the token.
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { storage } from "@/src/utils/storage";

const DEVICE_ID_KEY = "declic.deviceId";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL as string;

function uuid(): string {
  // RFC4122-ish v4, good enough for an anonymous device id.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceUserId(): Promise<string> {
  const existing = await storage.getItem<string>(DEVICE_ID_KEY, "");
  if (existing) return existing;
  const id = uuid();
  await storage.setItem(DEVICE_ID_KEY, id);
  return id;
}

/**
 * Ask for permission, fetch the native device token and register it with the
 * backend relay. Safe to call on every app open (tokens rotate; backend
 * upserts). No-op on web and when permission is not granted.
 */
export async function registerForPush(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return;

    const tokenResp = await Notifications.getDevicePushTokenAsync();
    const user_id = await getDeviceUserId();

    await fetch(`${BACKEND_URL}/api/register-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id,
        platform: Platform.OS,
        device_token: String(tokenResp.data),
      }),
    });
  } catch {
    // Push is best-effort; never block app start on failure.
  }
}
