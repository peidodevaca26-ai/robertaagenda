import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Appointment,
  agendaText,
  dailyEvents,
  eventSchema,
  findConflict,
  occursOn,
} from "../lib/events";
const event: Appointment = {
  id: "one",
  title: "Consulta",
  category: "Atendimento",
  date: "2026-01-31",
  time: "09:00",
  duration: 60,
  recurrence: "none",
  location: "Sala 1",
  notes: "",
  status: "scheduled",
};
test("valida formulário e impede horário/duração inválidos", () => {
  assert.equal(eventSchema.safeParse(event).success, true);
  for (const value of [
    { ...event, title: " " },
    { ...event, date: "2026-02-30" },
    { ...event, time: "25:00" },
    { ...event, duration: 0 },
    { ...event, time: "23:30", duration: 60 },
  ])
    assert.equal(eventSchema.safeParse(value).success, false);
});
test("aceita as novas categorias de rotina", () => {
  for (const category of ["Academia", "Igreja", "Saúde", "Família", "Trabalho", "Estudos", "Lazer", "Outros"] as const) {
    assert.equal(eventSchema.safeParse({ ...event, category }).success, true);
  }
  assert.equal(eventSchema.safeParse({ ...event, category: "Categoria inválida" }).success, false);
});
test("recorrência semanal respeita início e dias exatos", () => {
  const e = { ...event, recurrence: "weekly" } as Appointment;
  assert.equal(occursOn(e, "2026-02-07"), true);
  assert.equal(occursOn(e, "2026-02-08"), false);
  assert.equal(occursOn(e, "2026-01-24"), false);
});
test("quinzenal alterna semanas", () => {
  const e = { ...event, recurrence: "biweekly" } as Appointment;
  assert.equal(occursOn(e, "2026-02-07"), false);
  assert.equal(occursOn(e, "2026-02-14"), true);
});
test("mensal usa último dia em mês curto e retorna ao dia original", () => {
  const e = { ...event, recurrence: "monthly" } as Appointment;
  assert.equal(occursOn(e, "2026-02-28"), true);
  assert.equal(occursOn(e, "2026-03-31"), true);
  assert.equal(occursOn(e, "2026-03-28"), false);
  assert.equal(occursOn(e, "2028-02-29"), true);
});
test("cancelamento remove todas as ocorrências da agenda", () => {
  assert.deepEqual(
    dailyEvents(
      [{ ...event, status: "cancelled", recurrence: "weekly" }],
      "2026-02-07",
    ),
    [],
  );
});
test("conflitos consideram duração, bordas e exclusão do próprio evento", () => {
  assert.equal(findConflict(event, [event]), undefined);
  assert.equal(
    findConflict({ ...event, id: "two", time: "09:30" }, [event])?.id,
    "one",
  );
  assert.equal(
    findConflict({ ...event, id: "two", time: "10:00" }, [event]),
    undefined,
  );
  assert.equal(
    findConflict({ ...event, id: "two", time: "08:30" }, [event])?.id,
    "one",
  );
});
test("conflitos consideram repetições futuras e cancelamentos", () => {
  const recurring = { ...event, recurrence: "weekly" } as Appointment;
  assert.equal(
    findConflict({ ...event, id: "two", date: "2026-02-07" }, [recurring])?.id,
    "one",
  );
  assert.equal(
    findConflict({ ...event, id: "two", date: "2026-02-08" }, [recurring]),
    undefined,
  );
  assert.equal(
    findConflict({ ...event, id: "two", status: "cancelled" }, [event]),
    undefined,
  );
});
test("detecta conflito mensal que surge em mês posterior", () => {
  assert.ok(
    findConflict(
      { ...event, id: "two", date: "2026-01-30", recurrence: "monthly" },
      [{ ...event, recurrence: "monthly" }],
    ),
  );
});
test("resumo cronológico omite cancelados e observações privadas", () => {
  const text = agendaText(
    [
      { ...event, id: "later", time: "16:00", notes: "segredo" },
      event,
      { ...event, id: "cancel", title: "Cancelado", status: "cancelled" },
    ],
    event.date,
  );
  assert.ok(text.indexOf("09:00") < text.indexOf("16:00"));
  assert.ok(!text.includes("segredo"));
  assert.ok(!text.includes("Cancelado"));
  assert.match(agendaText([], event.date), /Nenhum compromisso/);
});
test("editar série muda ocorrências; excluir remove da lista", () => {
  let list = [event];
  list = list.map((e) => ({ ...e, date: "2026-02-01", recurrence: "weekly" }));
  assert.equal(dailyEvents(list, "2026-01-31").length, 0);
  assert.equal(dailyEvents(list, "2026-02-08").length, 1);
  list = list.filter((e) => e.id !== event.id);
  assert.equal(dailyEvents(list, "2026-02-08").length, 0);
});
