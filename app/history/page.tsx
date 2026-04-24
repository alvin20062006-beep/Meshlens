"use client"

import { useEffect, useMemo, useState } from "react"
import { getRecentJobs } from "@/lib/supabase"
import { agentRegistry } from "@/lib/agents"

type JobRow = {
  id?: unknown
  agent_id?: unknown
  status?: unknown
  created_at?: unknown
  projects?: { name?: unknown } | null
}

function badgeStyle(status: string) {
  if (status === "completed") return { bg: "#1b5e20", fg: "#ffffff", label: "completed" }
  if (status === "running") return { bg: "var(--accent)", fg: "#ffffff", label: "running" }
  if (status === "failed") return { bg: "var(--error)", fg: "#ffffff", label: "failed" }
  return { bg: "var(--border)", fg: "var(--text-secondary)", label: status || "pending" }
}

export default function HistoryPage() {
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const agentNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of agentRegistry) map.set(a.agent_id, a.name)
    return map
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await getRecentJobs(20)
        if (cancelled) return
        if (error) throw new Error(error.message)
        setJobs(Array.isArray(data) ? (data as JobRow[]) : [])
      } catch (e: unknown) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : "Failed to load history"
        setError(msg)
        setJobs([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Job History</h1>
          <div className="mt-2 text-sm text-[color:var(--text-secondary)]">
            All results replayed from stored snapshots.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-pulse rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]" />
            <div className="mt-3 text-sm text-[color:var(--text-secondary)]">Loading history...</div>
          </div>
        </div>
      ) : error ? (
        <div className="mt-6 ml-card text-sm text-[color:var(--error)]">{error}</div>
      ) : jobs.length === 0 ? (
        <div className="mt-6 ml-card">
          <div className="text-sm text-[color:var(--text-secondary)]">
            No jobs yet. Go to Marketplace to run an agent.
          </div>
          <a
            className="mt-3 inline-flex text-sm underline underline-offset-4 text-[color:var(--text-secondary)]"
            href="/marketplace"
          >
            Go to Marketplace
          </a>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {jobs.map((j) => {
            const jobId = j.id ? String(j.id) : "-"
            const agentId = j.agent_id ? String(j.agent_id) : "-"
            const status = j.status ? String(j.status) : "pending"
            const ts = j.created_at ? String(j.created_at) : "-"
            const projectName = (j.projects?.name ? String(j.projects?.name) : "-") || "-"
            const agentName = agentNameById.get(agentId) || agentId
            const st = badgeStyle(status)

            return (
              <div key={jobId} className="ml-card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Job: {jobId}</div>
                    <div className="mt-2 text-xs text-[color:var(--text-secondary)]">
                      Agent: <span className="text-[color:var(--text-primary)]">{agentName}</span>
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--text-secondary)]">
                      Project: <span className="text-[color:var(--text-primary)]">{projectName}</span>
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--text-secondary)]">Timestamp: {ts}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center rounded-full px-3 py-1 text-[11px]"
                      style={{ background: st.bg, color: st.fg }}
                    >
                      {st.label}
                    </span>
                    <a
                      className="ml-btn-primary inline-flex h-10 items-center justify-center px-4 text-xs font-semibold"
                      href={`/result/${jobId}`}
                    >
                      View
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

