import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
export async function GET(req: NextRequest) {
  const token_hash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type");
  if (token_hash && (type === "invite" || type === "magiclink")) {
    try {
      const db = await supabaseServer();
      const { error } = await db.auth.verifyOtp({ token_hash, type });
      if (!error)
        return NextResponse.redirect(new URL("/", req.url), {
          headers: {
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          },
        });
    } catch {}
  }
  return new NextResponse(
    "Convite inválido ou expirado. Solicite um novo link ao administrador.",
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}
