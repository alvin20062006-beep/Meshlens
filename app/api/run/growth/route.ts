import { NextResponse } from "next/server"
import type { Project } from "@/lib/types"
import { checkRateLimit, getClientIP } from "@/lib/ratelimit"
import { callLLM, parseJSONResponse } from "@/lib/llm"
import { isLegacyPlaceholderProjectId } from "@/lib/demo-connect"
import { createJob, saveProject, updateJob } from "@/lib/supabase"

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null
}

function safeNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

async function resolveProjectId(project: Project): Promise<string> {
  if (project.id && !isLegacyPlaceholderProjectId(project.id)) return project.id
  const res = await saveProject({
    slug: project.resolved_slug,
    name: project.name,
    mint: project.resolved_mint,
    source_url: project.source_url,
    verification: project.verification,
  })
  if (res.error || !res.data?.id) throw new Error(res.error?.message || "Failed to save project")
  return String(res.data.id)
}

function fallbackPlan(projectName: string, holder_context_used: boolean) {
  return {
    days: Array.from({ length: 7 }).map((_, i) => ({
      day: i + 1,
      theme: `Day ${i + 1}: Execution`,
      actions: [
        "Publish a concise update with a clear call-to-action",
        "Run 1 community activation loop (AMA / spaces / thread)",
        "Review metrics and iterate the next day's message",
      ],
      metric: "Daily active community interactions",
    })),
    summary: `7-day plan for ${projectName}`,
    holder_context_used,
  }
}

export async function POST(req: Request) {
  // Rate limit check first
  const ip = getClientIP(req)
  const rl = checkRateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded", resetAt: rl.resetAt }, { status: 429 })
  }

  const missing: string[] = []
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE")
  // LLM optional (fallback)
  if (missing.length) {
    return NextResponse.json({ error: "Missing configuration", details: missing }, { status: 400 })
  }

  const body = (await req.json().catch(() => null)) as
    | null
    | { project?: unknown; holderData?: unknown }

  const projectRec = asRecord(body?.project)
  if (!projectRec) return NextResponse.json({ error: "Invalid project" }, { status: 400 })
  const project = projectRec as unknown as Project

  const holderRec = asRecord(body?.holderData)
  const top5 = safeNum(holderRec?.top5_percent)
  const top10 = safeNum(holderRec?.top10_percent)
  const holder_context_used = Boolean(body?.holderData)

  // Generate job_id
  const job_id = `JOB-${Date.now()}`
  const timestamp = new Date().toISOString()

  // Save to Supabase with status="running"
  let project_id: string
  try {
    project_id = await resolveProjectId(project)
    project.id = project_id
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Project save failed"
    return NextResponse.json(
      { error: "Missing configuration", details: ["SUPABASE"], message: msg },
      { status: 400 }
    )
  }
  const input = { project, holderData: body?.holderData ?? null }

  await createJob({
    id: job_id,
    agent_id: "growth_strategist_v1",
    project_id,
    input,
    status: "running",
  })

  const system =
    "You are a Web3 growth strategist. Return strictly valid JSON only. No explanation, no markdown, no text outside JSON."
  const user =
    `Create a 7-day growth plan for '${project.name}'. ` +
    `Holder context: top5=[${top5}]%, top10=[${top10}]% ` +
    `(mark as unavailable if not provided, still generate plan). ` +
    `Return JSON: { days: [{ day: number, theme: string, actions: string[], metric: string }], summary: string, holder_context_used: boolean }`

  let output: object = fallbackPlan(project.name || "Project", holder_context_used)
  let llmError: string | null = null

  try {
    const llm = await callLLM({ system, user, maxTokens: 1200 })
    if (!llm.success) {
      llmError = llm.error || "LLM failed"
    } else {
      const parsed = parseJSONResponse(llm.content)
      const rec = asRecord(parsed)
      if (rec && Array.isArray(rec.days) && typeof rec.summary === "string") {
        output = rec as object
      } else {
        llmError = "Invalid LLM JSON"
      }
    }
  } catch (e: unknown) {
    llmError = e instanceof Error ? e.message : "LLM exception"
  }

  // Never fail: always complete with best-effort output
  const job = {
    job_id,
    agent_id: "growth_strategist_v1",
    project,
    input,
    data_snapshot: {
      holder_context: { top5_percent: top5, top10_percent: top10, holder_context_used },
      llm_error: llmError,
    },
    output,
    status: "completed",
    timestamp,
  }

  await updateJob(job_id, {
    status: "completed",
    output,
    data_snapshot: job.data_snapshot ?? undefined,
    error: llmError ?? undefined,
  })

  console.log("[JOB]", job_id, "growth_strategist_v1", "completed")

  return NextResponse.json(job)
}

