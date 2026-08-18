import { supabase } from "./supabase";

// Supabase Storage's JS upload accepts an ArrayBuffer/Blob, not a bare file:// URI, so we
// read the local picked file through fetch() first (the standard approach for Expo/RN).
export async function uploadImageFromUri(bucket: string, path: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "image/jpeg";

  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
