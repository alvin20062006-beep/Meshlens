import { NextResponse } from "next/server"
import { saveProject } from "@/lib/supabase-server"

function looksLikeSolanaMint(v: string): boolean {
  const s = String(v || "")
    .trim()
    .replace(/\s+/g, "")
  // Base58 public keys are typically 32-44 chars. We only need a cheap heuristic here.
  if (s.length < 32 || s.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

function missingConfigDetails() {
  const details: string[] = []
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    details.push("SUPABASE")
  }
  return details
}

async function resolveFromBagsIfAvailable(slug: string): Promise<
  | { ok: true; mint: string; name: string; source_url: string }
  | { ok: false; status: number; message: string }
> {
  const apiKey = process.env.BAGS_API_KEY
  if (!apiKey) return { ok: false, status: 400, message: "BAGS_API_KEY not configured" }

  const baseUrl = "https://public-api-v2.bags.fm/api/v1"

  // If the input already looks like a mint address, verify existence via tokenMint endpoint.
  // Docs: GET /token-launch/creator/v3?tokenMint=...
  if (looksLikeSolanaMint(slug)) {
    const verifyUrl = `${baseUrl}/token-launch/creator/v3?tokenMint=${encodeURIComponent(slug)}`
    const res = await fetch(verifyUrl, {
      method: "GET",
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    }).catch(() => null)

    if (!res) return { ok: false, status: 502, message: "Bags API request failed" }
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      try {
        const parsed = JSON.parse(text) as { error?: unknown; message?: unknown }
        const msg =
          (typeof parsed?.error === "string" && parsed.error) ||
          (typeof parsed?.message === "string" && parsed.message) ||
          text ||
          "Bags API error"
        return { ok: false, status: res.status, message: msg }
      } catch {
        return { ok: false, status: res.status, message: text || "Bags API error" }
      }
    }

    const dataUnknown = (await res.json().catch(() => null)) as unknown
    const rec = dataUnknown && typeof dataUnknown === "object" ? (dataUnknown as Record<string, unknown>) : null
    const success = rec?.success === true
    if (!success) {
      const err = typeof rec?.error === "string" ? String(rec.error) : "Bags verification failed"
      return { ok: false, status: 404, message: err }
    }

    // creator endpoint doesn't include token name; keep it minimal and use the mint for name.
    return { ok: true, mint: slug, name: slug, source_url: `https://bags.fm/${slug}` }
  }

  const url = `${baseUrl}/token-launch/feed`
  const res = await fetch(url, {
    method: "GET",
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  }).catch(() => null)

  if (!res) return { ok: false, status: 502, message: "Bags API request failed" }
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    // Bags commonly returns JSON: { success:false, error:"..." }
    try {
      const parsed = JSON.parse(text) as { error?: unknown; message?: unknown }
      const msg =
        (typeof parsed?.error === "string" && parsed.error) ||
        (typeof parsed?.message === "string" && parsed.message) ||
        text ||
        "Bags API error"
      return { ok: false, status: res.status, message: msg }
    } catch {
      return { ok: false, status: res.status, message: text || "Bags API error" }
    }
  }

  const dataUnknown = (await res.json().catch(() => null)) as unknown
  if (!dataUnknown || typeof dataUnknown !== "object") {
    return { ok: false, status: 502, message: "Unexpected Bags API response" }
  }
  const itemsUnknown = (dataUnknown as { response?: unknown }).response
  if (!Array.isArray(itemsUnknown)) {
    return { ok: false, status: 502, message: "Unexpected Bags API response" }
  }

  const target = slug.trim().toLowerCase()
  const hit = itemsUnknown.find((it) => {
    const obj = it as Record<string, unknown> | null
    const name = String(obj?.name || "").toLowerCase()
    const symbol = String(obj?.symbol || "").toLowerCase()
    return name === target || symbol === target
  })
  const hitObj = hit as Record<string, unknown> | null
  if (!hitObj?.tokenMint) {
    return {
      ok: false,
      status: 404,
      message:
        "Not found in Bags launch feed. Bags public API does not support full symbol/slug search — try a token mint address.",
    }
  }
  return {
    ok: true,
    mint: String(hitObj.tokenMint),
    name: String(hitObj.name || slug),
    source_url: `https://bags.fm/${slug}`,
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | { slug?: unknown }
  const slug = typeof body?.slug === "string" ? body.slug.trim().replace(/\s+/g, "") : ""
  if (!slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 })

  const missing = missingConfigDetails()
  if (missing.length) {
    return NextResponse.json(
      { error: "Missing configuration", details: missing },
      { status: 400 }
    )
  }

  const bags = await resolveFromBagsIfAvailable(slug)
  if (!bags.ok) {
    return NextResponse.json({ error: bags.message }, { status: bags.status })
  }

  const verification = "Verified from Bags" as const
  let data: unknown = null
  try {
    const res = await saveProject({
      slug,
      name: bags.name,
      mint: bags.mint,
      source_url: bags.source_url,
      verification,
    })
    data = res.data
    if (res.error) {
      return NextResponse.json({ error: String(res.error.message || res.error) }, { status: 400 })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Supabase error"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  console.log("[JOB]", "connect", slug, "completed")

  const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : null
  return NextResponse.json({
    id: rec?.id ? String(rec.id) : slug,
    source_url: bags.source_url,
    resolved_slug: slug,
    resolved_mint: bags.mint,
    verification,
    name: bags.name,
  })
}

