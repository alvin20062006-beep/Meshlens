"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { agentRegistry, importAgent } from "@/lib/agents"
import { useUIStore } from "@/lib/store"
import { ProjectBadge } from "@/components/ProjectBadge"
import { AgentCard } from "@/components/AgentCard"
import type { Agent } from "@/lib/types"

export default function MarketplacePage() {
  const router = useRouter()
  const currentProject = useUIStore((s) => s.currentProject)
  const credits = useUIStore((s) => s.credits)

  const [agents, setAgents] = useState(() => [...agentRegistry])
  const [open, setOpen] = useState(false)
  const [manifestText, setManifestText] = useState("")
  const [importError, setImportError] = useState<string | null>(null)

  function onRun(agentId: string) {
    router.push(`/job/${agentId}`)
  }

  function onImport() {
    setImportError(null)
    try {
      const parsed = JSON.parse(manifestText || "{}") as Partial<Agent>
      importAgent(parsed)
      setAgents([...agentRegistry])
      setManifestText("")
      setOpen(false)
    } catch {
      setImportError("Invalid JSON manifest")
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {currentProject ? (
              <ProjectBadge project={currentProject} />
            ) : (
              <div className="ml-card text-sm text-[color:var(--text-secondary)]">
                No project connected. Go to <a className="underline" href="/connect">/connect</a>.
              </div>
            )}
          </div>
          <div className="ml-card w-fit text-sm">
            <span className="text-[color:var(--text-secondary)]">Credits:</span>{" "}
            <span className="font-semibold">{credits}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold">Agent Marketplace</h1>
          <button type="button" className="ml-btn-secondary h-11 px-4 text-sm" onClick={() => setOpen(true)}>
            Import Agent
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.agent_id}
              agent={agent}
              hasProject={Boolean(currentProject)}
              onRun={() => onRun(agent.agent_id)}
            />
          ))}
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-xl">
            <div className="ml-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Import Agent</div>
                  <div className="mt-1 text-xs text-[color:var(--text-secondary)]">
                    Paste a JSON agent manifest. Imported agents will appear as Coming Soon.
                  </div>
                </div>
                <button
                  type="button"
                  className="ml-btn-secondary h-9 px-3 text-xs"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>

              <textarea
                className="ml-input mt-4 min-h-40 w-full p-3 text-xs"
                value={manifestText}
                onChange={(e) => setManifestText(e.target.value)}
                placeholder='{"name":"My Agent","capabilities":["x"]}'
              />

              {importError ? (
                <div className="mt-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] p-3 text-xs text-[color:var(--error)]">
                  {importError}
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-end gap-3">
                <button type="button" className="ml-btn-secondary h-10 px-4 text-xs" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="ml-btn-primary h-10 px-4 text-xs font-semibold" onClick={onImport}>
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

