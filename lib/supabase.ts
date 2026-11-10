import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { createChunkedStorage, type KeyValueStore } from "./chunked-storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values."
  );
}

// On a phone the session lives in the device's secure storage (Keychain / Keystore), split
// into chunks because a session is larger than SecureStore accepts in one value.
const secureStore: KeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

// SecureStore doesn't exist in a browser. The web build is for development previews; it
// uses the browser's own storage (and nothing at all when rendered outside a browser).
const browserStore: KeyValueStore = {
  getItem: async (key) => (typeof localStorage === "undefined" ? null : localStorage.getItem(key)),
  setItem: async (key, value) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === "web" ? browserStore : createChunkedStorage(secureStore),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

let channelSeq = 0;

// supabase.channel(name) returns the *existing* channel when one with that name is already
// open, and adding listeners to an already-subscribed channel throws. Two screens watching
// the same row at once (e.g. the checkout modal over its task screen) would collide, so give
// every subscriber its own channel.
export function realtimeChannel(name: string) {
  channelSeq += 1;
  return supabase.channel(`${name}#${channelSeq}`);
}
