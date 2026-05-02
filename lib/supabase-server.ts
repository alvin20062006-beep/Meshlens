import "server-only"

import { createClient } from "@supabase/supabase-js"

export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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
