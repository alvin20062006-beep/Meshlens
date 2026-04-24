"use client"

import type { Agent } from "@/lib/types"

type Props = {
  agent: Agent
  hasProject: boolean
  onRun?: () => void
}

function statusStyle(status: Agent["status"]) {
  if (status === "active") return { bg: "#1b5e20", fg: "#ffffff", label: "Active" }
  if (status === "preview") return { bg: "#7a5a00", fg: "#ffffff", label: "Preview" }
  return { bg: "var(--border)", fg: "var(--text-secondary)", label: "Coming Soon" }
}

export function AgentCard({ agent, hasProject, onRun }: Props) {
  const canRun = agent.status === "active" && hasProject
  const st = statusStyle(agent.status)

  return (
    <div className="ml-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold">{agent.name}</div>
            <span className="ml-badge px-2 py-0.5 text-[11px]">
              {agent.provider} · v{agent.version}
            </span>
          </div>
          <div className="mt-2 text-xs text-[color:var(--text-secondary)]">{agent.description}</div>
        </div>
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-[11px]"
          style={{ background: st.bg, color: st.fg }}
        >
          {st.label}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {agent.capabilities.map((c) => (
          <span key={c} className="ml-badge px-2 py-0.5 text-[11px]">
            {c}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-[color:var(--text-secondary)]">
          Price: <span className="text-[color:var(--text-primary)]">{agent.price}</span> credits
        </div>
        <button
          type="button"
          className="ml-btn-primary h-10 px-4 text-xs font-semibold disabled:opacity-50"
          onClick={onRun}
          disabled={!canRun}
        >
          Run Agent
        </button>
      </div>

      {!hasProject ? (
        <div className="mt-3 text-xs text-[color:var(--text-secondary)]">
          Connect a project to run agents.
        </div>
      ) : null}
    </div>
  )
}

