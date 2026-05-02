"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useUIStore } from "@/lib/store"
import type { Project } from "@/lib/types"

type Props = {
  params: { id: string }
}

type LogLine = { at: number; text: string }

const LOG_PLAN: LogLine[] = [
  { at: 0, text: "Connecting to project..." },
  { at: 800, text: "Fetching holder data from Helius..." },
  { at: 2000, text: "Analyzing distribution..." },
  { at: 3500, text: "Generating recommendations..." },
]

export default function JobPage({ params }: Props) {
  const router = useRouter()
  const agent_id = params.id

  const currentProject = useUIStore((s) => s.currentProject)
  const [status, setStatus] = useState<"loading" | "failed">("loading")
  const [error, setError] = useState<string | null>(null)
  const [visibleLogs, setVisibleLogs] = useState<LogLine[]>([])

  const temp_job_id = useMemo(() => `PENDING-${Date.now()}`, [])
  const ranRef = useRef(false)

  useEffect(() => {
    if (!currentProject) {
      router.replace("/connect")
    }
  }, [currentProject, router])

  useEffect(() => {
    if (!currentProject) return
    if (ranRef.current) return
    ranRef.current = true

    let cancelled = false
    const timers: number[] = []

    setStatus("loading")
    setError(null)
    setVisibleLogs([])

    for (const step of LOG_PLAN) {
      const t = window.setTimeout(() => {
        if (cancelled) return
        setVisibleLogs((prev) => [...prev, step])
      }, step.at)
      timers.push(t)
    }

    async function run(project: Project) {
      try {
        const res = await fetch(`/api/run/${agent_id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project }),
        })

        if (!res.ok) {
          const txt = await res.text()
          throw new Error(txt || "Run failed")
        }

        const result = (await res.json()) as { job_id?: unknown }
        const jobId = result?.job_id ? String(result.job_id) : ""
        if (!jobId) throw new Error("Missing job_id in response")

        // Always navigate on success. Do not gate on `cancelled`: in React 18 dev Strict Mode
        // the effect cleanup runs before the fetch resolves, which sets cancelled=true and
        // would skip router.replace even though the job completed (History would still show it).
        try {
          sessionStorage.setItem(`meshlens_job_${jobId}`, JSON.stringify(result))
        } catch {
          // ignore
        }
        if (!cancelled) {
          setVisibleLogs((prev) => [...prev, { at: Date.now(), text: "Complete." }])
        }
        router.replace(`/result/${jobId}`)
      } catch (e: unknown) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : "Run failed"
        setStatus("failed")
        setError(msg)
      }
    }

    void run(currentProject)

    return () => {
      cancelled = true
      for (const t of timers) window.clearTimeout(t)
    }
  }, [agent_id, currentProject, router])

  function retry() {
    ranRef.current = false
    setVisibleLogs([])
    setError(null)
    setStatus("loading")
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="ml-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Running Agent...</h1>
            <div className="mt-2 text-xs text-[color:var(--text-secondary)]">Agent: {agent_id}</div>
            <div className="mt-1 text-xs text-[color:var(--text-secondary)]">Temp Job: {temp_job_id}</div>
          </div>

          {/* Progress indicator: no glow, opacity pulse */}
          <div className="h-10 w-10 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] animate-pulse" />
        </div>

        <div className="mt-6 space-y-2">
          {visibleLogs.map((l, idx) => (
            <div key={`${l.at}-${idx}`} className="text-sm text-[color:var(--text-secondary)]">
              {l.text}
            </div>
          ))}
        </div>

        {status === "failed" ? (
          <div className="mt-6">
            <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] p-3 text-xs text-[color:var(--error)]">
              {error || "Failed"}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button type="button" className="ml-btn-primary h-11 px-4 text-sm font-semibold" onClick={retry}>
                Retry
              </button>
              <a className="ml-btn-secondary inline-flex h-11 items-center justify-center px-4 text-sm" href="/marketplace">
                Back to Marketplace
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}

