import { NextResponse } from "next/server"

import { POST as runHolder } from "../holder/route"
import { POST as runGrowth } from "../growth/route"

export async function POST(req: Request, ctx: { params: { agentId: string } }) {
  const agentId = ctx?.params?.agentId

  if (agentId === "holder_insight_v1") {
    return runHolder(req)
  }

  if (agentId === "growth_strategist_v1") {
    return runGrowth(req)
  }

  return NextResponse.json({ error: "Unknown agent" }, { status: 404 })
}

