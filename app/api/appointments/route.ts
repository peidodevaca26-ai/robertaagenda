import { sameOrigin } from "@/lib/request-security";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { eventSchema } from "@/lib/events";
import { z } from "zod";
export const dynamic = "force-dynamic";
const columns =
  "id,title,category,date,time,duration,recurrence,location,notes,status";
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
async function handle(req: NextRequest) {
  if (process.env.DATA_MODE !== "supabase")
    return reply(
      { error: "Modo demonstrativo: banco de dados desativado." },
      503,
    );
  if (req.method !== "GET" && !sameOrigin(req.headers))
    return reply({ error: "Origem não permitida." }, 403);
  try {
    const db = await supabaseServer();
    const {
      data: { user },
      error,
    } = await db.auth.getUser();
    if (error || !user)
      return reply(
        {
          error:
            "Acesso privado. Abra seu link de convite ou solicite um novo link ao administrador.",
        },
        401,
      );
    if (req.method === "GET") {
      const { data, error } = await db
        .from("appointments")
        .select(columns)
        .eq("user_id", user.id)
        .order("date");
      if (error)
        return reply({ error: "Não foi possível carregar a agenda." }, 500);
      return reply(data);
    }
    const raw = await req.json();
    if (req.method === "DELETE") {
      const id = z.uuid().parse(raw.id);
      const { data, error } = await db
        .from("appointments")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id")
        .single();
      return error || !data
        ? reply({ error: "Não foi possível excluir o compromisso." }, 400)
        : reply({ ok: true });
    }
    const input = eventSchema.parse(raw);
    // A função SQL serializa alterações por usuário e verifica conflitos recorrentes.
    const id = req.method === "PUT" ? z.uuid().parse(raw.id) : null;
    const { data, error: saveError } = await db.rpc("save_appointment", {
      p_id: id,
      p_event: input,
    });
    if (saveError)
      return reply(
        {
          error: saveError.message.includes("schedule_conflict")
            ? "Conflito de horários. Escolha outro horário."
            : "Não foi possível salvar o compromisso.",
        },
        409,
      );
    return reply(data);
  } catch (error) {
    return reply(
      {
        error:
          error instanceof z.ZodError
            ? "Dados inválidos. Confira os campos."
            : "Acesso privado indisponível. Verifique a configuração.",
      },
      400,
    );
  }
}
export const GET = handle,
  POST = handle,
  PUT = handle,
  DELETE = handle;
