/**
 * Legacy helpers kept for backwards compatibility with older client state.
 * Demo connect has been removed from the product surface.
 */

export function isDemoConnectEnabled(): boolean {
  return false
}

export function findDemoProject(): undefined {
  return undefined
}

/** Slugs used before a real UUID exists in client state; must re-resolve via Supabase */
export function isLegacyPlaceholderProjectId(id: string | undefined): boolean {
  if (!id) return false
  return id === "demo" || id === "test"
}
