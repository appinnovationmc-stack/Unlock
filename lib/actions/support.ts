"use server";
import { createClient } from "@/lib/supabase/server";
export async function submitSupportRequest(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in to send a request." };
  const { data, error } = await supabase.from("support_requests").insert({ user_id: user.id, category: String(form.get("category")), message: String(form.get("message")) }).select("id").single();
  return error ? { error: "Your request could not be saved. Please try again." } : { id: data.id as string };
}
