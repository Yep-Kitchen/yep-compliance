import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// We type our data via explicit state annotations in components rather than
// via Database generics, which require Supabase's CLI-generated types to work correctly.
export const supabase = createClient(url, anon);

export function createServerClient() {
  return createClient(url, anon);
}
