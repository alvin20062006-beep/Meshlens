import type { Project } from "@/lib/types";

type Props = {
  project: Project;
};

function truncateMint(mint: string) {
  const s = String(mint || "")
  if (s.length <= 10) return s
  return `${s.slice(0, 4)}...${s.slice(-4)}`
}

export function ProjectBadge({ project }: Props) {
  const isVerified = project.verification === "Verified from Bags"
  const label = isVerified ? "Verified from Bags" : "Demo Project"
  const mint = truncateMint(project.resolved_mint)

  return (
    <div className="ml-card flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">{project.name || project.resolved_slug || "Project"}</div>
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-[11px]"
          style={{
            background: isVerified ? "#1b5e20" : "var(--border)",
            color: isVerified ? "#ffffff" : "var(--text-secondary)",
          }}
        >
          {label}
        </span>
      </div>
      <div className="text-xs text-[color:var(--text-secondary)]">
        Mint: <span className="text-[color:var(--text-primary)]">{mint}</span>
      </div>
    </div>
  );
}

