import { NextRequest, NextResponse } from "next/server";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;

async function convexMutation(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  if (data.status === "error") throw new Error(data.errorMessage ?? "Convex error");
  return data.value;
}

export async function POST(req: NextRequest) {
  try {
    const { userId, event, details } = await req.json();
    if (!userId || !event) {
      return NextResponse.json({ error: "Missing userId or event" }, { status: 400 });
    }

    await convexMutation("security:logLoginAttempt", {
      email: "",
      userId,
      success: false,
      method: "password",
      blockedReason: `${event}: ${details ?? ""}`,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      userAgent: req.headers.get("user-agent") ?? undefined,
      riskScore: 90,
      riskFactors: [event],
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
