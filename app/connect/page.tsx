"use client"

import { useMemo, useState } from "react"
import { useUIStore } from "@/lib/store"
import type { Project } from "@/lib/types"
import { ProjectBadge } from "@/components/ProjectBadge"

function parseSlug(input: string): string {
  const s = (input || "").trim()
  if (!s) return ""
  try {
    const u = new URL(s)
    const parts = u.pathname.split("/").filter(Boolean)
    const raw = parts[0] || ""
    // Solana mints are base58; users sometimes paste accidental spaces in the URL segment.
    return raw.replace(/\s+/g, "")
  } catch {
    const raw = s.replace(/^\/+/, "").split("/")[0] || ""
    return raw.replace(/\s+/g, "")
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
        try {
          const j = JSON.parse(t) as { error?: unknown }
          const msg = typeof j?.error === "string" ? j.error : ""
          setError(msg || t || "Failed to connect")
        } catch {
          setError(t || "Failed to connect")
        }
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

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <div className="ml-card">
        <h1 className="text-2xl font-semibold">Connect Your Project</h1>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          Paste a Bags project URL (works best for recent Bags launches). If it fails, paste the token mint address.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <input
            className="ml-input h-11 w-full px-3 text-sm"
            placeholder="https://bags.fm/your-project or token mint address"
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

