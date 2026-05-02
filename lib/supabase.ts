import { createClient } from "@supabase/supabase-js"

// Browser-safe Supabase client (anon key only). Do not import server-side helpers from this file.
type SupabaseClient = ReturnType<typeof createClient>

let _supabase: SupabaseClient | null = null

function getSupabase() {
  if (_supabase) return _supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error("Supabase client not configured")
  }
  _supabase = createClient(url, anonKey)
  return _supabase
}

export const supabase: SupabaseClient = new Proxy({} as unknown as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase() as unknown as Record<PropertyKey, unknown>
    return client[prop]
  },
}) as unknown as SupabaseClient

export async function getJob(id: string) {
  const { data, error } = await supabase.from("jobs").select("*, projects(*)").eq("id", id).single()
  return { data, error }
}

export async function getRecentJobs(limit = 20) {
  const { data, error } = await supabase
    .from("jobs")
    .select("*, projects(*)")
    .order("created_at", { ascending: false })
    .limit(limit)
  return { data, error }
}
