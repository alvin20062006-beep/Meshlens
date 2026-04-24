import { NextResponse } from "next/server"
import type { Action, Job, JobOutput, Project, RiskFlag } from "@/lib/types"
import { checkRateLimit, getClientIP } from "@/lib/ratelimit"
import { callLLM, parseJSONResponse } from "@/lib/llm"
import { isLegacyPlaceholderProjectId } from "@/lib/demo-connect"
import { createJob, saveProject, updateJob } from "@/lib/supabase"

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

function extractTokenAccounts(json: unknown): Array<{ address: string; amount_ui: number }> {
  const rec = asRecord(json)
  const result = asRecord(rec?.result)
  const tokenAccounts = result?.tokenAccounts
  if (!Array.isArray(tokenAccounts)) return []

  const out: Array<{ address: string; amount_ui: number }> = []
  for (const item of tokenAccounts) {
    const it = asRecord(item)
    const address =
      (typeof it?.owner === "string" && it.owner) ||
      (typeof it?.address === "string" && it.address) ||
      (typeof it?.account === "string" && it.account) ||
      ""

    const amountUi =
      asNumber(asRecord(it?.tokenAmount)?.uiAmount) ??
      asNumber(asRecord(it?.amount)?.uiAmount) ??
      asNumber(asRecord(it?.tokenAmount)?.uiAmountString) ??
      asNumber(asRecord(it?.amount)?.uiAmountString) ??
      asNumber(it?.amount) ??
      0

    if (address) out.push({ address, amount_ui: amountUi })
  }
  return out
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
  // LLM is optional (fallback is allowed)
  return details
}

async function ensureProjectId(project: Project): Promise<string> {
  if (project.id && !isLegacyPlaceholderProjectId(project.id)) return project.id
  const slug = project.resolved_slug
  const mint = project.resolved_mint
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

  const missing = missingConfigDetails()
  if (missing.length) {
    return NextResponse.json({ error: "Missing configuration", details: missing }, { status: 400 })
  }

  const body = (await req.json().catch(() => null)) as null | { project?: unknown }
  const project = asRecord(body?.project) as unknown as Project | null

  // Step 2: Validate input
  if (!project?.resolved_mint) {
    return NextResponse.json({ error: "Missing project.resolved_mint" }, { status: 400 })
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
        params: { mint: project.resolved_mint, limit: 1000, page: 1 },
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
        params: [project.resolved_mint],
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
  const allAccounts = extractTokenAccounts(holderJson)
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
    "You are a token analyst. Return strictly valid JSON only. No explanation, no markdown, no text outside JSON."
  const user =
    `Analyze token holder data. Return JSON with exactly: { risk_flags: [{ key: string, severity: 'low'|'medium'|'high', evidence: string }], actions: [{ title: string, why: string, priority: 'P1'|'P2'|'P3' }], summary: string } ` +
    `Data: top5_percent=[${top5_percent.toFixed(2)}]%, top10_percent=[${top10_percent.toFixed(2)}]%, total_holders=[${total_holders}], top_holder=[${top_holder.toFixed(2)}]% ` +
    `Rules: evidence and why MUST include specific percentages. 2-3 risk flags, 2-3 actions.`

  const llm = await callLLM({ system, user, maxTokens: 1000 })

  // Step 9: Parse LLM response
  const parsed = llm.success ? parseJSONResponse(llm.content) : null
  const parsedRec = asRecord(parsed)
  const parseFailed = llm.success && !parsed
  const llmFailed = !llm.success

  const risk_flags: RiskFlag[] = Array.isArray(parsedRec?.risk_flags)
    ? (parsedRec?.risk_flags as unknown[]).flatMap((rf) => {
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

  const actions: Action[] = Array.isArray(parsedRec?.actions)
    ? (parsedRec?.actions as unknown[]).flatMap((ac) => {
        const a = asRecord(ac)
        const title = typeof a?.title === "string" ? a.title : null
        const why = typeof a?.why === "string" ? a.why : null
        const priority = a?.priority === "P1" || a?.priority === "P2" || a?.priority === "P3" ? (a.priority as Action["priority"]) : null
        if (!title || !why || !priority) return []
        return [{ title, why, priority }]
      })
    : []

  let summary =
    typeof parsedRec?.summary === "string" ? (parsedRec.summary as string) : "Analysis unavailable"
  if (llmFailed) summary = "Analysis unavailable (LLM failed)"
  if (parseFailed) summary = "Analysis unavailable (parse failed)"

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
        success: llm.success,
        error: llm.error ?? null,
        raw: llm.content,
      },
    },
    output: jobOutput,
    status: "completed",
    timestamp,
  }

  // Step 11: updateJob() in Supabase
  await updateJob(job_id, {
    status: "completed",
    output: jobOutput,
    data_snapshot: job.data_snapshot ?? undefined,
  })

  console.log("[JOB]", job_id, "holder_insight_v1", "completed")

  // Step 12: Return complete job JSON
  return NextResponse.json(job)
}

