import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { signJWT, verifyJWT } from "@/lib/jwt";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    console.log("[/api/profile/update] Request received");
    console.log("[/api/profile/update] Cookies:", request.cookies.getAll().map(c => c.name));

    const { userId, name, email } = await request.json();
    console.log("[/api/profile/update] Body:", { userId, name, email });

    if (!userId || !name || !email) {
      console.error("[/api/profile/update] Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Try to get JWT from hr-auth-token cookie first
    const cookieStore = await cookies();
    let jwt = cookieStore.get("hr-auth-token")?.value;
    console.log("[/api/profile/update] hr-auth-token cookie:", jwt ? "exists" : "none");

    // If not found, try NextAuth session
    if (!jwt) {
      console.log("[/api/profile/update] Attempting to get NextAuth session...");
      const session = await getServerSession(authOptions);
      console.log("[/api/profile/update] NextAuth session result:", session ? {
        user: session.user?.email,
        name: session.user?.name,
      } : "null");

      if (!session?.user) {
        console.error("[/api/profile/update] No session found");
        return NextResponse.json(
          { error: "Not authenticated" },
          { status: 401 }
        );
      }

      // Create new JWT from NextAuth session
      jwt = await signJWT({
        userId: session.user.id || userId,
        name: session.user.name || name,
        email: session.user.email || email,
        role: (session.user as any).role || "employee",
        department: (session.user as any).department,
        position: (session.user as any).position,
        employeeType: (session.user as any).employeeType,
        avatar: (session.user as any).avatar,
      });

      console.log("[/api/profile/update] JWT created from NextAuth session");
    }

    console.log("[/api/profile/update] JWT token available:", !!jwt);

    if (!jwt) {
      console.error("[/api/profile/update] No JWT token found");
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const payload = await verifyJWT(jwt);
    console.log("[/api/profile/update] JWT payload:", payload ? { userId: payload.userId } : "invalid");

    if (!payload) {
      console.error("[/api/profile/update] Invalid JWT");
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    // Skip userId mismatch check - Convex uses internal IDs, JWT uses OAuth provider IDs
    // Authorization is already handled by getServerSession above

    const newJwt = await signJWT({
      userId: payload.userId,
      name,
      email,
      role: payload.role,
      department: payload.department,
      position: payload.position,
      employeeType: payload.employeeType,
      avatar: payload.avatar,
    });

    console.log("[/api/profile/update] New JWT created");

    const response = NextResponse.json({ success: true });

    response.cookies.set("hr-auth-token", newJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    console.log("[/api/profile/update] Cookie set in response");

    return response;
  } catch (error) {
    console.error("[/api/profile/update] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
