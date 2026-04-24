"use client"

import { useMemo, useState } from "react"
import { useUIStore } from "@/lib/store"
import type { Project } from "@/lib/types"
import { ProjectBadge } from "@/components/ProjectBadge"

const demoConnectEnabled = process.env.NEXT_PUBLIC_DEMO_CONNECT !== "false"

function parseSlug(input: string): string {
  const s = (input || "").trim()
  if (!s) return ""
  try {
    const u = new URL(s)
    const parts = u.pathname.split("/").filter(Boolean)
    return parts[0] || ""
  } catch {
    return s.replace(/^\/+/, "").split("/")[0] || ""
  }
}

export default function ConnectPage() {
  const setProject = useUIStore((s) => s.setProject)
  const currentProject = useUIStore((s) => s.currentProject)

  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slug = useMemo(() => parseSlug(url), [url])

  async function onConnect() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
      if (!res.ok) {
        const t = await res.text()
        setError(t || "Failed to connect")
        return
      }
      const data = (await res.json()) as Project
      setProject(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to connect"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function onUseDemo() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "demo" }),
      })
      if (!res.ok) {
        const t = await res.text()
        setError(t || "Failed to connect demo")
        return
      }
      const data = (await res.json()) as Project
      setProject(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to connect demo"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="ml-card">
        <h1 className="text-2xl font-semibold">Connect Your Project</h1>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          Paste a Bags project URL to resolve its mint.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <input
            className="ml-input h-11 w-full px-3 text-sm"
            placeholder="https://bags.fm/your-project"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />

          <button
            type="button"
            className="ml-btn-primary h-11 w-full text-sm font-semibold disabled:opacity-50"
            onClick={onConnect}
            disabled={!slug || loading}
          >
            {loading ? "Connecting..." : "Connect Project"}
          </button>
        </div>

        {demoConnectEnabled ? (
          <>
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[color:var(--border)]" />
              <div className="text-xs text-[color:var(--text-secondary)]">or</div>
              <div className="h-px flex-1 bg-[color:var(--border)]" />
            </div>

            <button type="button" className="ml-btn-secondary h-11 w-full text-sm" onClick={onUseDemo} disabled={loading}>
              Use Demo Project
            </button>
          </>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] p-3 text-xs text-[color:var(--error)]">
            {error}
          </div>
        ) : null}

        {currentProject ? (
          <div className="mt-6 flex flex-col gap-3">
            <ProjectBadge project={currentProject} />
            <a
              className="ml-btn-primary inline-flex h-11 items-center justify-center px-4 text-sm font-semibold"
              href="/marketplace"
            >
              Enter Marketplace
            </a>
          </div>
        ) : null}
      </div>
    </main>
  )
}

