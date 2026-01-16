import { createClient } from "@supabase/supabase-js";

const url = (import.meta as any).env?.VITE_SUPABASE_URL;
const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("❌ Supabase is not configured. Missing environment variables:", { url, key });
  console.error("⚠️  Please create frontend/.env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
  console.error("⚠️  Then RESTART the dev server for changes to take effect.");
}

export const supabase = createClient(url, key);
