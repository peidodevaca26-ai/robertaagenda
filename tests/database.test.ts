import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("PostgreSQL: migração, isolamento RLS, conflito e CRUD por RPC", async () => {
  const db = new PGlite();
  try {
    // Apenas o contrato auth.uid()/papéis é simulado; RLS e SQL são PostgreSQL real.
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`,
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/202611020001_agenda.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      readFileSync(
        new URL("../supabase/tests/security.sql", import.meta.url),
        "utf8",
      ),
    );
  } finally {
    await db.close();
  }
});
