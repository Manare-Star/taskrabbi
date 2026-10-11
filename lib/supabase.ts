import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values."
  );
}

// expo-secure-store caps individual values at ~2048 bytes on some platforms.
// Supabase session tokens normally fit; if you add more claims/scopes and hit the
// limit, switch this adapter to chunk large values across multiple keys.
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
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
