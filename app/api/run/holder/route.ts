import { NextResponse } from "next/server"
import type { Action, Job, JobOutput, Project, RiskFlag } from "@/lib/types"
import { checkRateLimit, getClientIP } from "@/lib/ratelimit"
import { callLLM, parseJSONResponse } from "@/lib/llm"
import { isLegacyPlaceholderProjectId } from "@/lib/demo-connect"
import { createJob, saveProject, updateJob } from "@/lib/supabase-server"

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function extractTokenAccounts(json: unknown, decimals = 0): Array<{ address: string; amount_ui: number }> {
  const rec = asRecord(json)
  const result = asRecord(rec?.result)
  // Helius DAS API uses snake_case: token_accounts
  const tokenAccounts = result?.token_accounts ?? result?.tokenAccounts
  if (!Array.isArray(tokenAccounts)) return []

  // Divisor to convert raw integer amount → UI amount
  const divisor = decimals > 0 ? Math.pow(10, decimals) : 1

  const out: Array<{ address: string; amount_ui: number }> = []
  for (const item of tokenAccounts) {
    const it = asRecord(item)
    const address =
      (typeof it?.owner === "string" && it.owner) ||
      (typeof it?.address === "string" && it.address) ||
      (typeof it?.account === "string" && it.account) ||
      ""

    // Helius DAS getTokenAccounts returns a raw integer `amount` field.
    // Prefer nested uiAmount (legacy/enriched format) then fall back to raw amount ÷ decimals.
    const rawOrUi =
      asNumber(asRecord(it?.tokenAmount)?.uiAmount) ??
      asNumber(asRecord(it?.amount)?.uiAmount) ??
      asNumber(asRecord(it?.tokenAmount)?.uiAmountString) ??
      asNumber(asRecord(it?.amount)?.uiAmountString) ??
      asNumber(it?.amount) ??
      0
    // If we got a raw integer (no nested uiAmount), divide by 10^decimals
    const isRaw =
      asRecord(it?.tokenAmount)?.uiAmount == null &&
      asRecord(it?.amount)?.uiAmount == null &&
      asRecord(it?.tokenAmount)?.uiAmountString == null &&
      asRecord(it?.amount)?.uiAmountString == null
    const amount_ui = isRaw ? rawOrUi / divisor : rawOrUi

    if (address) out.push({ address, amount_ui })
  }
  return out
}

function extractDecimals(supplyJson: unknown): number {
  const rec = asRecord(supplyJson)
  const result = asRecord(rec?.result)
  const value = asRecord(result?.value)
  const d = asNumber(value?.decimals)
  return d !== null && Number.isInteger(d) && d >= 0 ? d : 0
}

function extractSupplyUi(json: unknown): number {
  const rec = asRecord(json)
  const result = asRecord(rec?.result)
  const value = asRecord(result?.value)
  const uiAmount =
    asNumber(value?.uiAmount) ?? asNumber(value?.uiAmountString) ?? asNumber(value?.amount) ?? 0
  return uiAmount > 0 ? uiAmount : 0
}

function missingConfigDetails() {
  const details: string[] = []
  if (!process.env.HELIUS_API_KEY) details.push("HELIUS_API_KEY")
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) details.push("SUPABASE")
  if (!process.env.LLM_API_KEY || !process.env.LLM_MODEL) details.push("LLM")
  return details
}

function normalizeMint(mint: string): string {
  return String(mint || "").trim().replace(/\s+/g, "")
}

function validateHolderLLMShape(parsed: unknown): {
  ok: boolean
  risk_flags: RiskFlag[]
  actions: Action[]
  summary: string | null
} {
  const rec = asRecord(parsed)
  if (!rec) return { ok: false, risk_flags: [], actions: [], summary: null }

  const risk_flags: RiskFlag[] = Array.isArray(rec.risk_flags)
    ? (rec.risk_flags as unknown[]).flatMap((rf) => {
        const r = asRecord(rf)
        const key = typeof r?.key === "string" ? r.key : null
        const severity =
          r?.severity === "low" || r?.severity === "medium" || r?.severity === "high"
            ? (r.severity as RiskFlag["severity"])
            : null
        const evidence = typeof r?.evidence === "string" ? r.evidence : null
        if (!key || !severity || !evidence) return []
        return [{ key, severity, evidence }]
      })
    : []

  const actions: Action[] = Array.isArray(rec.actions)
    ? (rec.actions as unknown[]).flatMap((ac) => {
        const a = asRecord(ac)
        const title = typeof a?.title === "string" ? a.title : null
        const why = typeof a?.why === "string" ? a.why : null
        const priority = a?.priority === "P1" || a?.priority === "P2" || a?.priority === "P3" ? (a.priority as Action["priority"]) : null
        if (!title || !why || !priority) return []
        return [{ title, why, priority }]
      })
    : []

  const summary = typeof rec.summary === "string" ? (rec.summary as string) : null

  const ok = risk_flags.length === 3 && actions.length === 3 && Boolean(summary && summary.trim())
  return { ok, risk_flags, actions, summary }
}

async function ensureProjectId(project: Project): Promise<string> {
  if (project.id && !isLegacyPlaceholderProjectId(project.id)) return project.id
  const slug = project.resolved_slug
  const mint = normalizeMint(project.resolved_mint)
  const name = project.name
  const source_url = project.source_url
  const verification = project.verification

  const res = await saveProject({ slug, name, mint, source_url, verification })
  if (res.error || !res.data?.id) {
    throw new Error(res.error?.message || "Failed to save project")
  }
  return String(res.data.id)
}

export async function POST(req: Request) {
  // Step 1: Rate limiting
  const ip = getClientIP(req)
  const rl = checkRateLimit(ip)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded", resetAt: rl.resetAt }, { status: 429 })
  }

  const body = (await req.json().catch(() => null)) as null | { project?: unknown }
  const project = asRecord(body?.project) as unknown as Project | null

  // Step 2: Validate input
  if (!project?.resolved_mint) {
    return NextResponse.json({ error: "Missing project.resolved_mint" }, { status: 400 })
  }

  const mint = normalizeMint(project.resolved_mint)
  if (!mint) {
    return NextResponse.json({ error: "Invalid project.resolved_mint" }, { status: 400 })
  }
  project.resolved_mint = mint

  const missing = missingConfigDetails()
  if (missing.length) {
    return NextResponse.json({ error: "Missing configuration", details: missing }, { status: 400 })
  }

  // Step 3: Generate job_id
  const job_id = `JOB-${Date.now()}`
  const timestamp = new Date().toISOString()

  // Step 4: Save job to Supabase (running)
  let project_id: string
  try {
    project_id = await ensureProjectId(project)
    project.id = project_id
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Project save failed"
    return NextResponse.json(
      { error: "Missing configuration", details: ["SUPABASE"], message: msg },
      { status: 400 }
    )
  }
  const input = { project }

  await createJob({
    id: job_id,
    agent_id: "holder_insight_v1",
    project_id,
    input,
    status: "running",
  })

  const heliusKey = process.env.HELIUS_API_KEY!

  const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`

  // Step 5: Fetch holder data
  let holderJson: unknown = null
  try {
    const res = await fetch(heliusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "meshlens",
        method: "getTokenAccounts",
        params: { mint, limit: 1000, page: 1 },
      }),
    })
    holderJson = await res.json().catch(() => null)
    if (!res.ok) {
      const errText = typeof holderJson === "string" ? holderJson : JSON.stringify(holderJson)
      await updateJob(job_id, { status: "failed", error: errText })
      return NextResponse.json({ error: errText, job_id }, { status: 502 })
    }
    const err = asRecord(holderJson)?.error
    if (err) {
      const errText = JSON.stringify(err)
      await updateJob(job_id, { status: "failed", error: errText })
      return NextResponse.json({ error: errText, job_id }, { status: 502 })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Helius request failed"
    await updateJob(job_id, { status: "failed", error: msg })
    return NextResponse.json({ error: msg, job_id }, { status: 502 })
  }

  // Step 6: Fetch token supply
  let supplyJson: unknown = null
  try {
    const res = await fetch(heliusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "supply",
        method: "getTokenSupply",
        params: [mint],
      }),
    })
    supplyJson = await res.json().catch(() => null)
    if (!res.ok) {
      const errText = typeof supplyJson === "string" ? supplyJson : JSON.stringify(supplyJson)
      await updateJob(job_id, { status: "failed", error: errText })
      return NextResponse.json({ error: errText, job_id }, { status: 502 })
    }
    const err = asRecord(supplyJson)?.error
    if (err) {
      const errText = JSON.stringify(err)
      await updateJob(job_id, { status: "failed", error: errText })
      return NextResponse.json({ error: errText, job_id }, { status: 502 })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Supply request failed"
    await updateJob(job_id, { status: "failed", error: msg })
    return NextResponse.json({ error: msg, job_id }, { status: 502 })
  }

  // Step 7: Calculate distribution
  const total_supply = extractSupplyUi(supplyJson)
  const decimals = extractDecimals(supplyJson)
  const allAccounts = extractTokenAccounts(holderJson, decimals)
    .filter((a) => a.amount_ui > 0)
    .sort((a, b) => b.amount_ui - a.amount_ui)

  const total_holders = allAccounts.length
  const top20Raw = allAccounts.slice(0, 20)
  const top20 = top20Raw.map((a) => {
    const percent_of_supply = total_supply > 0 ? (a.amount_ui / total_supply) * 100 : 0
    return {
      address: a.address,
      amount_ui: a.amount_ui,
      percent_of_supply,
    }
  })

  const top5_percent = top20.slice(0, 5).reduce((sum, a) => sum + a.percent_of_supply, 0)
  const top10_percent = top20.slice(0, 10).reduce((sum, a) => sum + a.percent_of_supply, 0)
  const top_holder = top20[0]?.percent_of_supply ?? 0

  const distribution: JobOutput["distribution"] = {
    top5_percent,
    top10_percent,
    accounts: top20,
  }

  // Step 8: Call LLM
  const system =
    "You are a token analyst. Your entire reply MUST be ONE JSON object (OpenAI json_object mode).\n" +
    "Schema:\n" +
    '{ "risk_flags": [ { "key": string, "severity": "low"|"medium"|"high", "evidence": string } x3 ],' +
    '  "actions": [ { "title": string, "why": string, "priority": "P1"|"P2"|"P3" } x3 ],' +
    '  "summary": string }\n' +
    "Rules:\n" +
    "- Exactly 3 risk_flags and exactly 3 actions.\n" +
    "- evidence and why MUST include numeric percentages with a % sign (use the provided facts).\n" +
    "- summary must be 2-4 sentences and MUST mention top5_percent, top10_percent, total_holders, top_holder_percent using the exact numbers provided.\n" +
    "- No extra keys beyond risk_flags, actions, summary.\n" +
    "- No markdown, no code fences, no commentary outside JSON."
  const user =
    `Analyze token holder concentration and return ONLY JSON.\n` +
    `Facts (use these exact numbers; if total_holders is 0, explicitly say holder snapshot is empty but still return valid JSON):\n` +
    `- top5_percent: ${top5_percent.toFixed(2)}\n` +
    `- top10_percent: ${top10_percent.toFixed(2)}\n` +
    `- total_holders: ${total_holders}\n` +
    `- top_holder_percent: ${top_holder.toFixed(2)}\n` +
    `- mint: ${mint}\n`

  const llmPrimary = await callLLM({ system, user, maxTokens: 1200, jsonObject: true })
  const parsedPrimary = llmPrimary.success ? parseJSONResponse(llmPrimary.content) : null
  const primary = validateHolderLLMShape(parsedPrimary)

  let llmFinal = llmPrimary
  let validated = primary
  let llmRepair: Awaited<ReturnType<typeof callLLM>> | null = null

  if (!primary.ok) {
    const repairSystem =
      "You fix invalid JSON outputs. Return ONLY ONE JSON object (OpenAI json_object mode) matching the required schema. No markdown."
    const repairUser =
      `Rewrite the following model output into valid JSON with keys risk_flags (3), actions (3), summary.\n` +
      `If the text is not JSON, infer the intended content but keep it consistent with these facts:\n` +
      `- top5_percent: ${top5_percent.toFixed(2)}\n` +
      `- top10_percent: ${top10_percent.toFixed(2)}\n` +
      `- total_holders: ${total_holders}\n` +
      `- top_holder_percent: ${top_holder.toFixed(2)}\n` +
      `- mint: ${mint}\n\n` +
      `MODEL_OUTPUT_START\n${llmPrimary.content}\nMODEL_OUTPUT_END`

    llmRepair = await callLLM({ system: repairSystem, user: repairUser, maxTokens: 1200, jsonObject: true })
    const parsedRepair = llmRepair.success ? parseJSONResponse(llmRepair.content) : null
    const repaired = validateHolderLLMShape(parsedRepair)

    llmFinal = llmRepair
    validated = repaired
  }

  if (!llmFinal.success || !validated.ok || !validated.summary) {
    const err =
      (!llmFinal.success ? llmFinal.error : null) ||
      "LLM did not return usable holder analysis JSON (expected 3 risk_flags, 3 actions, summary)."
    await updateJob(job_id, {
      status: "failed",
      error: String(err),
      data_snapshot: {
        helius: { url: heliusUrl, getTokenAccounts: holderJson, getTokenSupply: supplyJson },
        computed: {
          total_supply,
          total_holders,
          top_holder_percent: top_holder,
          top5_percent,
          top10_percent,
        },
        llm: {
          success: llmFinal.success,
          error: llmFinal.error ?? null,
          raw_primary: llmPrimary.content,
          raw_repair: llmRepair?.content ?? null,
        },
      },
    })
    return NextResponse.json({ error: String(err), job_id }, { status: 502 })
  }

  const risk_flags = validated.risk_flags
  const actions = validated.actions
  const summary = validated.summary

  const jobOutput: JobOutput = {
    distribution,
    risk_flags: risk_flags.length ? risk_flags : [],
    actions: actions.length ? actions : [],
    citations: [
      {
        label: "Helius JSON-RPC: getTokenAccounts",
        source: "https://docs.helius.dev/",
        job_id,
        timestamp,
      },
      {
        label: "Solana RPC: getTokenSupply (via Helius endpoint)",
        source: "https://solana.com/docs/rpc/http/gettokensupply",
        job_id,
        timestamp,
      },
    ],
    summary,
  }

  // Step 10: Build complete job object
  const job: Job = {
    job_id,
    agent_id: "holder_insight_v1",
    project,
    input,
    data_snapshot: {
      helius: {
        url: heliusUrl,
        getTokenAccounts: holderJson,
        getTokenSupply: supplyJson,
      },
      computed: {
        total_supply,
        total_holders,
        top_holder_percent: top_holder,
        top5_percent,
        top10_percent,
      },
      llm: {
        success: llmFinal.success,
        error: llmFinal.error ?? null,
        raw: llmFinal.content,
        raw_primary: llmPrimary.content,
        parsed_ok: true,
      },
    },
    output: jobOutput,
    status: "completed",
    timestamp,
  }

  // Step 11: updateJob() in Supabase
  const updateResult = await updateJob(job_id, {
    status: "completed",
    output: jobOutput,
    data_snapshot: job.data_snapshot ?? undefined,
  })
  if (updateResult.error) {
    // Log but don't fail — the full job is still returned so the client can cache it in sessionStorage.
    console.error("[JOB]", job_id, "updateJob failed:", updateResult.error.message, updateResult.error)
  }

  console.log("[JOB]", job_id, "holder_insight_v1", "completed")

  // Step 12: Return complete job JSON
  return NextResponse.json(job)
}

