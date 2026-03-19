import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get("admin_token")?.value
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const res = await fetch(`${process.env.DATA_API_URL}/reload`, {
    method: "POST",
    headers: { "x-internal-secret": process.env.INTERNAL_API_SECRET! },
  })

  if (!res.ok) {
    return NextResponse.json({ error: "reload 실패" }, { status: 500 })
  }

  return NextResponse.json({ status: "reloaded" })
}
