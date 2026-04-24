import { createClient } from "@supabase/supabase-js"

// Client-side (anon key, safe to expose)
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

// Server-side only (service role key, never expose to client)
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Database helpers
export async function saveProject(project: {
  slug: string
  name: string
  mint: string
  source_url: string
  verification: string
}) {
  const client = getServiceClient()
  const { data, error } = await client
    .from("projects")
    .upsert({ ...project }, { onConflict: "slug" })
    .select()
    .single()
  return { data, error }
}

export async function createJob(job: {
  id: string
  agent_id: string
  project_id: string
  input: object
  status: string
}) {
  const client = getServiceClient()
  const { data, error } = await client
    .from("jobs")
    .insert({ ...job, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select()
    .single()
  return { data, error }
}

export async function updateJob(
  id: string,
  updates: { status: string; output?: object; data_snapshot?: object; error?: string }
) {
  const client = getServiceClient()
  const { data, error } = await client
    .from("jobs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
  return { data, error }
}

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

