/**
 * Demo connect slugs (demo/test) without Bags. Enabled by default; set NEXT_PUBLIC_DEMO_CONNECT=false to disable.
 */

export type DemoProject = {
  slug: string
  mint: string
  name: string
}

const demoProjects: DemoProject[] = [
  {
    slug: "demo",
    mint: "So11111111111111111111111111111111111111112",
    name: "Demo Project",
  },
  {
    slug: "test",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "Test Token",
  },
]

export function isDemoConnectEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_CONNECT !== "false"
}

export function findDemoProject(slug: string): DemoProject | undefined {
  if (!isDemoConnectEnabled()) return undefined
  const key = slug.trim().toLowerCase()
  return demoProjects.find((p) => p.slug === key)
}

/** Slugs used before a real UUID exists in client state; must re-resolve via Supabase */
export function isLegacyPlaceholderProjectId(id: string | undefined): boolean {
  if (!id) return false
  return id === "demo" || id === "test"
}
