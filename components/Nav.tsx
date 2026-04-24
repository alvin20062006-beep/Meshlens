"use client"

import { usePathname } from "next/navigation"
import { useUIStore } from "@/lib/store"

export function Nav() {
  const pathname = usePathname()
  const project = useUIStore((s) => s.currentProject)
  const credits = useUIStore((s) => s.credits)

  if (pathname === "/") return null

  return (
    <div className="ml-nav">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <a href="/" className="text-sm font-bold tracking-tight text-[color:var(--text-primary)]">
          MeshLens
        </a>

        <div className="hidden items-center gap-6 text-sm sm:flex">
          <a href="/marketplace" className="text-[color:var(--text-secondary)] hover:opacity-80">
            Marketplace
          </a>
          <a href="/history" className="text-[color:var(--text-secondary)] hover:opacity-80">
            History
          </a>
        </div>

        <div className="flex items-center gap-3 text-xs text-[color:var(--text-secondary)]">
          {project?.name ? (
            <span className="ml-badge px-3 py-1">{project.name}</span>
          ) : (
            <span className="ml-badge px-3 py-1">No Project</span>
          )}
          <span className="ml-badge px-3 py-1">
            Credits: <span className="text-[color:var(--text-primary)]">{credits}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

