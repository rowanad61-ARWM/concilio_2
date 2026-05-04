import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    status: "ok",
    commit: process.env.GIT_SHA ?? "unknown",
    timestamp: new Date().toISOString(),
  })
}
