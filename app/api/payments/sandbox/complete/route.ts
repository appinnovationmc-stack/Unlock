import { NextResponse } from "next/server";
// Sandbox completion must run through isolated database test fixtures, never a public GET.
export async function GET() {
  return NextResponse.json({ error: "Sandbox completion is available only through the isolated test harness" }, { status: 403 });
}
