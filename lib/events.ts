import { z } from "zod";

export const categories = [
  "Atendimento",
  "Pessoal",
  "Academia",
  "Igreja",
  "Saúde",
  "Família",
  "Trabalho",
  "Estudos",
  "Lazer",
  "Outros",
] as const;

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Informe o título.").max(160),
    category: z.enum(categories),
    date: z.iso
      .date()
      .refine(
        (d) => d >= "1900-01-01" && d <= "2100-12-31",
        "Use uma data entre 1900 e 2100.",
      ),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    duration: z.number().int().min(5).max(1440),
    recurrence: z.enum(["none", "weekly", "biweekly", "monthly"]),
    location: z.string().trim().max(500),
    notes: z.string().trim().max(2000),
    status: z.enum(["scheduled", "cancelled"]),
  })
  .refine(
    (v) =>
      Number(v.time.slice(0, 2)) * 60 + Number(v.time.slice(3)) + v.duration <=
      1440,
    {
      message: "O compromisso deve terminar no mesmo dia.",
      path: ["duration"],
    },
  );
export type EventInput = z.infer<typeof eventSchema>;
export type Appointment = EventInput & { id: string };
export const recurrenceLabels = {
  none: "Não repetir",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};
export function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parts(day: string) {
  return day.split("-").map(Number);
}
function ordinal(day: string) {
  const [y, m, d] = parts(day);
  return Date.UTC(y, m - 1, d) / 86400000;
}
export function occursOn(event: Appointment, day: string) {
  if (event.status === "cancelled" || day < event.date) return false;
  if (event.recurrence === "none") return event.date === day;
  if (event.recurrence === "monthly") {
    const [y, m, d] = parts(day);
    const original = parts(event.date)[2];
    return d === Math.min(original, new Date(y, m, 0).getDate());
  }
  return (
    (ordinal(day) - ordinal(event.date)) %
      (event.recurrence === "weekly" ? 7 : 14) ===
    0
  );
}
export function dailyEvents(events: Appointment[], day: string) {
  return events
    .filter((e) => occursOn(e, day))
    .sort(
      (a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title),
    );
}
function overlaps(a: Appointment, b: Appointment) {
  const minutes = (t: string) =>
    Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return (
    minutes(a.time) < minutes(b.time) + b.duration &&
    minutes(b.time) < minutes(a.time) + a.duration
  );
}
// Calendário gregoriano se repete em 400 anos. Semanal e quinzenal se alinham
// após no máximo 800 anos (146097 dias por ciclo de 400 anos).
export function findConflict(
  candidate: Appointment,
  events: Appointment[],
): Appointment | undefined {
  if (candidate.status === "cancelled") return;
  for (const other of events) {
    if (
      other.id === candidate.id ||
      other.status === "cancelled" ||
      !overlaps(candidate, other)
    )
      continue;
    if (candidate.recurrence === "none") {
      if (occursOn(other, candidate.date)) return other;
      continue;
    }
    if (other.recurrence === "none") {
      if (occursOn(candidate, other.date)) return other;
      continue;
    }
    if (candidate.recurrence !== "monthly" && other.recurrence !== "monthly") {
      const divisor =
        candidate.recurrence === "biweekly" && other.recurrence === "biweekly"
          ? 14
          : 7;
      if ((ordinal(candidate.date) - ordinal(other.date)) % divisor === 0)
        return other;
      continue;
    }
    const start = candidate.date > other.date ? candidate.date : other.date;
    const [y, m] = parts(start);
    const original = parts(
      candidate.recurrence === "monthly" ? candidate.date : other.date,
    )[2];
    for (let i = 0; i <= 9600; i++) {
      const first = new Date(Date.UTC(y, m - 1 + i, 1));
      const last = new Date(
        Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
      ).getUTCDate();
      first.setUTCDate(Math.min(original, last));
      const key = first.toISOString().slice(0, 10);
      if (occursOn(candidate, key) && occursOn(other, key)) return other;
    }
  }
}
export function agendaText(events: Appointment[], day: string) {
  const list = dailyEvents(events, day);
  return `Agenda • ${new Date(day + "T12:00:00").toLocaleDateString("pt-BR")}\n\n${list.length ? list.map((e) => `${e.time} · ${e.title} (${e.duration} min)${e.location ? " — " + e.location : ""}`).join("\n") : "Nenhum compromisso para este dia."}`;
}
export function demoEvents(today: string): Appointment[] {
  const base = {
    date: today,
    duration: 50,
    location: "",
    notes: "Dados fictícios para conhecer o painel.",
    status: "scheduled" as const,
  };
  return [
    {
      ...base,
      id: "demo-1",
      title: "Atendimento · Marina Costa",
      time: "09:00",
      category: "Atendimento",
      recurrence: "weekly",
    },
    {
      ...base,
      id: "demo-2",
      title: "Um tempo para cuidar de mim",
      time: "12:30",
      category: "Pessoal",
      recurrence: "none",
      duration: 60,
      location: "Parque da cidade",
    },
    {
      ...base,
      id: "demo-3",
      title: "Atendimento · Pedro Lima",
      time: "15:00",
      category: "Atendimento",
      recurrence: "biweekly",
    },
  ];
}
