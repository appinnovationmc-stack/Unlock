"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setConsumerAvatar(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "Log in first" };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a photo" };
  }
  if (file.size > 3 * 1024 * 1024) {
    return { error: "Keep it under 3 MB" };
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/face.${ext}`;

  const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg"
  });
  if (upErr) return { error: upErr.message };

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;

  const { error: rowErr } = await supabase
    .from("consumers")
    .update({ avatar_url: url })
    .eq("id", user.id);
  if (rowErr) return { error: rowErr.message };

  revalidatePath("/profile");
  revalidatePath("/discover");
  return { error: null, url };
}
