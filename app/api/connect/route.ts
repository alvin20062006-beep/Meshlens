import { NextResponse } from "next/server"
import { findDemoProject } from "@/lib/demo-connect"
import { saveProject } from "@/lib/supabase"

function missingConfigDetails() {
  const details: string[] = []
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    details.push("SUPABASE")
  }
  return details
}

async function resolveFromBagsIfAvailable(slug: string): Promise<
  | {
      mint: string
      name: string
      source_url: string
    }
  | null
> {
  const apiKey = process.env.BAGS_API_KEY
  if (!apiKey) return null

  const baseUrl = "https://public-api-v2.bags.fm/api/v1"
  const url = `${baseUrl}/token-launch/feed`
  const res = await fetch(url, {
    method: "GET",
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  }).catch(() => null)

  if (!res || !res.ok) return null
  const dataUnknown = (await res.json().catch(() => null)) as unknown
  if (!dataUnknown || typeof dataUnknown !== "object") return null
  const itemsUnknown = (dataUnknown as { response?: unknown }).response
  if (!Array.isArray(itemsUnknown)) return null

  const target = slug.trim().toLowerCase()
  const hit = itemsUnknown.find((it) => {
    const obj = it as Record<string, unknown> | null
    const name = String(obj?.name || "").toLowerCase()
    const symbol = String(obj?.symbol || "").toLowerCase()
    return name === target || symbol === target
  })
  const hitObj = hit as Record<string, unknown> | null
  if (!hitObj?.tokenMint) return null
  return {
    mint: String(hitObj.tokenMint),
    name: String(hitObj.name || slug),
    source_url: `https://bags.fm/${slug}`,
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | { slug?: unknown }
  const slug = typeof body?.slug === "string" ? body.slug.trim() : ""
  if (!slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 })

  const missing = missingConfigDetails()
  if (missing.length) {
    return NextResponse.json(
      { error: "Missing configuration", details: missing },
      { status: 400 }
    )
  }

  const demo = findDemoProject(slug)
  if (demo) {
    const verification = "Demo Project" as const
    const source_url = `https://bags.fm/${demo.slug}`
    let data: unknown = null
    try {
      const res = await saveProject({
        slug: demo.slug,
        name: demo.name,
        mint: demo.mint,
        source_url,
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
    console.log("[JOB]", "connect", demo.slug, "completed")
    const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : null
    return NextResponse.json({
      id: rec?.id ? String(rec.id) : demo.slug,
      source_url,
      resolved_slug: demo.slug,
      resolved_mint: demo.mint,
      verification,
      name: demo.name,
    })
  }

  const bags = await resolveFromBagsIfAvailable(slug)
  if (!bags) {
    return NextResponse.json({ error: "Project not found on Bags" }, { status: 404 })
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

