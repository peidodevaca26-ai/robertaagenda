import { sameOrigin } from "@/lib/request-security";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers))
    return new NextResponse(null, { status: 403 });
  try {
    const db = await supabaseServer();
    await db.auth.signOut();
  } catch {}
  return NextResponse.redirect(new URL("/", req.url), 303);
}
