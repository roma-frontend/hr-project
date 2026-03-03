import { NextRequest, NextResponse } from "next/server";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;

async function convexQuery(path: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  if (data.status === "error") return null;
  return data.value;
}

function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return 999;
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}

export async function POST(req: NextRequest) {
  try {
    const { userId, descriptor } = await req.json();

    if (!userId || !descriptor) {
      return NextResponse.json({ error: "Missing userId or descriptor" }, { status: 400 });
    }

    // Get stored face descriptor
    const profile = await convexQuery("faceRecognition:getFaceDescriptor", { userId });

    if (!profile?.faceDescriptor) {
      // No face registered → skip verification (allow)
      return NextResponse.json({ match: true, reason: "no_face_registered" });
    }

    const distance = euclideanDistance(descriptor, profile.faceDescriptor);
    const THRESHOLD = 0.5; // lower = stricter. 0.4-0.6 is typical

    return NextResponse.json({
      match: distance <= THRESHOLD,
      distance,
      threshold: THRESHOLD,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
