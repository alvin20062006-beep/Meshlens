"use client"

import { useEffect, useMemo, useState } from "react"
import { getJob } from "@/lib/supabase"
import type { Action, Job, JobOutput, Project, RiskFlag } from "@/lib/types"
import { HolderChart } from "@/components/HolderChart"
import { DataSources } from "@/components/DataSources"
import { CitationTag } from "@/components/CitationTag"

type Props = { params: { id: string } }

function trunc(s: string, a = 4, b = 4) {
  const x = String(s || "")
  if (x.length <= a + b + 3) return x
  return `${x.slice(0, a)}...${x.slice(-b)}`
}

function pctColor(p: number) {
  if (p > 50) return "text-[color:var(--error)]"
  if (p >= 20) return "text-yellow-300"
  return "text-green-300"
}

function safeNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null
}

function toProjectFromSupabaseRow(rowUnknown: unknown): Project {
  const row = asRecord(rowUnknown)
  const p = asRecord(row?.projects) ?? asRecord(row?.project) ?? {}
  return {
    id: p?.id ? String(p.id) : undefined,
    source_url: String(p?.source_url ?? "-"),
    resolved_slug: String(p?.slug ?? p?.resolved_slug ?? "-"),
    resolved_mint: String(p?.mint ?? p?.resolved_mint ?? "-"),
    verification: (p?.verification === "Verified from Bags" ? "Verified from Bags" : "Demo Project") as Project["verification"],
    name: String(p?.name ?? "-"),
  }
}

function toJobFromSupabaseRow(rowUnknown: unknown): Job {
  const row = asRecord(rowUnknown) ?? {}
  const project = toProjectFromSupabaseRow(rowUnknown)
  const output = (row?.output ?? null) as JobOutput | null
  const snapshot = (row?.data_snapshot ?? null) as object | null
  const ts = String(row?.created_at ?? row?.timestamp ?? new Date().toISOString())
  return {
    job_id: String(row?.id ?? row?.job_id ?? "-"),
    agent_id: String(row?.agent_id ?? "-"),
    project,
    input: (row?.input ?? {}) as object,
    data_snapshot: snapshot,
    output,
    status: (row?.status || "completed") as Job["status"],
    timestamp: ts,
    error: row?.error ? String(row.error) : undefined,
  }
}

function readSessionSnapshot(jobId: string): Job | null {
  try {
    const raw = sessionStorage.getItem(`meshlens_job_${jobId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Job
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

export default function ResultPage({ params }: Props) {
  const job_id = params.id
  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState<Job | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setNotFound(false)

      // Prefer Supabase, but fall back to sessionStorage if output is missing
      try {
        const { data, error } = await getJob(job_id)
        if (!cancelled) {
          if (error || !data) {
            throw new Error(error?.message || "Supabase fetch failed")
          }
          const fromSupabase = toJobFromSupabaseRow(data)
          // If Supabase row has no output (e.g. updateJob failed silently or schema mismatch),
          // prefer the sessionStorage snapshot which always carries the full API response.
          if (!fromSupabase.output) {
            const cached = readSessionSnapshot(job_id)
            if (cached?.output) {
              setJob(cached)
              setLoading(false)
              return
            }
          }
          setJob(fromSupabase)
          setLoading(false)
          return
        }
      } catch {
        // Fallback to local UI snapshot cache
        const cached = readSessionSnapshot(job_id)
        if (!cancelled) {
          if (cached) {
            setJob(cached)
            setLoading(false)
            return
          }
          setNotFound(true)
          setJob(null)
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [job_id])

  const output = job?.output ?? null
  const distribution = output?.distribution
  const accounts = useMemo(() => distribution?.accounts ?? [], [distribution])
  const top10 = useMemo(() => accounts.slice(0, 10), [accounts])
  const top5Percent = safeNum(distribution?.top5_percent)
  const top10Percent = safeNum(distribution?.top10_percent)
  const summary = output?.summary || "Analysis unavailable"

  const top5Addrs = useMemo(() => accounts.slice(0, 5).map((a) => a.address), [accounts])
  const top10Addrs = useMemo(() => accounts.slice(0, 10).map((a) => a.address), [accounts])
  const [showTop5, setShowTop5] = useState(false)
  const [showTop10, setShowTop10] = useState(false)

  function exportJson() {
    if (!job) return
    const blob = new Blob([JSON.stringify(job, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `meshlens-${job.job_id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copyReport() {
    if (!job) return
    const actions = (output?.actions ?? []).map((a) => `- ${a.title} (${a.priority}): ${a.why}`).join("\n")
    const text =
      `${job.project?.name || "-"}\n` +
      `Job: ${job.job_id}\n` +
      `Summary: ${summary}\n` +
      `Top 5 concentration: ${top5Percent.toFixed(2)}%\n` +
      `Top 10 concentration: ${top10Percent.toFixed(2)}%\n\n` +
      `Actions:\n${actions || "-"}\n`
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]" />
          <div className="mt-3 text-sm text-[color:var(--text-secondary)]">Loading snapshot...</div>
        </div>
      </main>
    )
  }

  if (notFound || !job) {
    return (
      <main className="mx-auto w-full max-w-3xl p-6">
        <div className="ml-card">
          <div className="text-lg font-semibold">Job not found</div>
          <a className="mt-3 inline-flex text-sm underline underline-offset-4 text-[color:var(--text-secondary)]" href="/history">
            Go to /history
          </a>
        </div>
      </main>
    )
  }

  const verification = job.project?.verification || "Demo Project"
  const isVerified = verification === "Verified from Bags"

  const riskFlags: RiskFlag[] = output?.risk_flags ?? []
  const actions: Action[] = output?.actions ?? []
  const citations = output?.citations ?? []

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-3xl font-bold">{job.project?.name || "-"}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[color:var(--text-secondary)]">
            <span>Mint: {trunc(job.project?.resolved_mint || "-")}</span>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-[11px]"
              style={{
                background: isVerified ? "#1b5e20" : "var(--border)",
                color: isVerified ? "#ffffff" : "var(--text-secondary)",
              }}
            >
              {verification}
            </span>
          </div>
          <div className="mt-2 text-xs text-[color:var(--text-secondary)]">
            Job: {job.job_id} · {job.timestamp || "-"}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="ml-badge px-3 py-1 text-xs">Replayed from snapshot</span>
          <button type="button" className="ml-btn-secondary h-10 px-4 text-xs" onClick={copyReport}>
            Copy Report
          </button>
          <button type="button" className="ml-btn-primary h-10 px-4 text-xs font-semibold" onClick={exportJson}>
            Export JSON
          </button>
        </div>
      </div>

      {/* Summary Block */}
      <section className="mt-6 ml-card">
        <div className="text-lg font-bold">{summary || "-"}</div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] p-4">
            <div className="text-xs text-[color:var(--text-secondary)]">Top 5 concentration</div>
            <div className={`mt-1 text-2xl font-bold ${pctColor(top5Percent)}`}>
              {top5Percent ? `${top5Percent.toFixed(2)}%` : "-"}
            </div>
          </div>
          <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] p-4">
            <div className="text-xs text-[color:var(--text-secondary)]">Top 10 concentration</div>
            <div className={`mt-1 text-2xl font-bold ${pctColor(top10Percent)}`}>
              {top10Percent ? `${top10Percent.toFixed(2)}%` : "-"}
            </div>
          </div>
        </div>
      </section>

      {/* Holder Distribution */}
      <section className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Holder Distribution (Top 10)</div>
            <div className="mt-1 text-xs text-[color:var(--text-secondary)]">
              {accounts.length === 0 ? "No holder data available" : "Visual proof from snapshot"}
            </div>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="mt-3 ml-card text-sm text-[color:var(--text-secondary)]">No holder data available</div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HolderChart accounts={top10} />

            <div className="ml-card">
              <div className="text-sm font-semibold">Top 10 Holders</div>
              <div className="mt-3 space-y-2 text-sm">
                {top10.map((a) => (
                  <div key={a.address} className="flex items-center justify-between gap-3">
                    <a
                      href={`https://solscan.io/account/${a.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[color:var(--text-secondary)] underline underline-offset-4 hover:opacity-80"
                    >
                      {trunc(a.address, 6, 4)}
                    </a>
                    <div className="text-[color:var(--text-primary)]">
                      {safeNum(a.percent_of_supply).toFixed(4)}%
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <button
                  type="button"
                  className="ml-btn-secondary h-9 w-full px-3 text-xs"
                  onClick={() => setShowTop5((v) => !v)}
                >
                  Top 5: {top5Percent.toFixed(2)}%
                </button>
                {showTop5 ? (
                  <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] p-3">
                    {top5Addrs.map((a) => (
                      <div key={a} className="mt-1">
                        <a
                          href={`https://solscan.io/account/${a}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-4 text-[color:var(--text-secondary)]"
                        >
                          {a}
                        </a>
                      </div>
                    ))}
                  </div>
                ) : null}

                <button
                  type="button"
                  className="ml-btn-secondary h-9 w-full px-3 text-xs"
                  onClick={() => setShowTop10((v) => !v)}
                >
                  Top 10: {top10Percent.toFixed(2)}%
                </button>
                {showTop10 ? (
                  <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] p-3">
                    {top10Addrs.map((a) => (
                      <div key={a} className="mt-1">
                        <a
                          href={`https://solscan.io/account/${a}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-4 text-[color:var(--text-secondary)]"
                        >
                          {a}
                        </a>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Risk Flags */}
      <section className="mt-6">
        <div className="text-sm font-semibold">Risk Flags</div>
        {output === null ? (
          <div className="mt-3 ml-card text-sm text-[color:var(--text-secondary)]">Analysis unavailable</div>
        ) : riskFlags.length === 0 ? (
          <div className="mt-3 ml-card text-sm text-[color:var(--text-secondary)]">-</div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {riskFlags.map((f) => {
              const border =
                f.severity === "high"
                  ? "border-[color:var(--error)]"
                  : f.severity === "medium"
                    ? "border-yellow-400"
                    : "border-green-400"
              return (
                <div key={f.key} className={`rounded-xl border ${border} bg-[color:var(--surface)] p-6`}>
                  <div className="text-sm font-semibold">{f.key}</div>
                  <div className="mt-2 text-xs text-[color:var(--text-secondary)]">{f.evidence || "-"}</div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Actions */}
      <section className="mt-6">
        <div className="text-sm font-semibold">Actions</div>
        {output === null ? (
          <div className="mt-3 ml-card text-sm text-[color:var(--text-secondary)]">Analysis unavailable</div>
        ) : actions.length === 0 ? (
          <div className="mt-3 ml-card text-sm text-[color:var(--text-secondary)]">-</div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {actions.map((a) => {
              const pbg = a.priority === "P1" ? "var(--error)" : a.priority === "P2" ? "#7a5a00" : "var(--border)"
              const pfg = a.priority === "P3" ? "var(--text-secondary)" : "#ffffff"
              const sourceHref = citations[0]?.source
              return (
                <div key={`${a.title}-${a.priority}`} className="ml-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold">{a.title}</div>
                    <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px]" style={{ background: pbg, color: pfg }}>
                      {a.priority}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-[color:var(--text-secondary)]">{a.why || "-"}</div>
                  <div className="mt-3">
                    <CitationTag href={sourceHref} label="source" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Data Sources (always visible) */}
      <section className="mt-6">
        <DataSources
          slug={job.project?.resolved_slug || "-"}
          mint={job.project?.resolved_mint || "-"}
          job_id={job.job_id}
          timestamp={job.timestamp}
        />
      </section>
    </main>
  )
}

