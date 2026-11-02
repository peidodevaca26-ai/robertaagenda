"use client";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  LayoutDashboard,
  List,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Pencil,
  Trash2,
  X,
  Copy,
  MessageCircle,
  Check,
  Ban,
  LogOut,
  CalendarCheck2,
  ArrowUpRight,
} from "lucide-react";
import {
  Appointment,
  EventInput,
  agendaText,
  categories,
  dailyEvents,
  dateKey,
  demoEvents,
  eventSchema,
  findConflict,
  recurrenceLabels,
} from "@/lib/events";
type View = "dashboard" | "calendar" | "list";
const blank = (date: string): EventInput => ({
  title: "",
  category: "Atendimento",
  date,
  time: "09:00",
  duration: 50,
  recurrence: "none",
  location: "",
  notes: "",
  status: "scheduled",
});
export default function Agenda({ demo }: { demo: boolean }) {
  const [today, setToday] = useState("");
  const [selected, setSelected] = useState("");
  const [month, setMonth] = useState("");
  const [events, setEvents] = useState<Appointment[]>([]);
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [form, setForm] = useState<EventInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [summary, setSummary] = useState(false);
  const [filter, setFilter] = useState("Todas");
  useEffect(() => {
    const day = dateKey(new Date());
    setToday(day);
    setSelected(day);
    setMonth(day.slice(0, 7));
    if (demo) setEvents(demoEvents(day));
    else {
      fetch("/api/appointments", { cache: "no-store" })
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw Error(data.error);
          setEvents(data);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [demo]);
  useEffect(() => {
    if (!form && !summary) return;
    const old = document.body.style.overflow;
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        setForm(null);
        setSummary(false);
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".modal button:not(:disabled), .modal a, .modal input, .modal select, .modal textarea",
          ),
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", close);
      previous?.focus();
    };
  }, [!!form, summary, saving]);
  const dayEvents = dailyEvents(events, selected).filter(
    (e) => filter === "Todas" || e.category === filter,
  );
  const todayEvents = dailyEvents(events, today);
  const upcoming: Array<{ day: string; event: Appointment }> = [];
  if (today)
    for (let i = 1; i <= 30 && upcoming.length < 4; i++) {
      const d = new Date(today + "T12:00:00");
      d.setDate(d.getDate() + i);
      const key = dateKey(d);
      for (const event of dailyEvents(events, key))
        if (upcoming.length < 4) upcoming.push({ day: key, event });
    }
  async function mutate(method: string, event: Appointment) {
    if (demo) {
      setEvents((prev) =>
        method === "DELETE"
          ? prev.filter((e) => e.id !== event.id)
          : method === "POST"
            ? [...prev, event]
            : prev.map((e) => (e.id === event.id ? event : e)),
      );
      return;
    }
    const response = await fetch("/api/appointments", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    setEvents((prev) =>
      method === "DELETE"
        ? prev.filter((e) => e.id !== event.id)
        : method === "POST"
          ? [...prev, data]
          : prev.map((e) => (e.id === event.id ? data : e)),
    );
  }
  function open(event?: Appointment) {
    setEditing(event ?? null);
    setForm(event ?? blank(selected || today));
    setFormError("");
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const parsed = eventSchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0].message);
      return;
    }
    const candidate = {
      ...parsed.data,
      id: editing?.id ?? crypto.randomUUID(),
    };
    const conflict = findConflict(candidate, events);
    if (conflict) {
      setFormError(
        `Este horário conflita com “${conflict.title}”. Considere também as repetições.`,
      );
      return;
    }
    setSaving(true);
    try {
      await mutate(editing ? "PUT" : "POST", candidate);
      setForm(null);
      setNotice("Compromisso salvo.");
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function action(event: Appointment, remove: boolean) {
    if (
      !confirm(
        remove
          ? "Excluir este compromisso e todas as suas repetições?"
          : event.status === "cancelled"
            ? "Reativar este compromisso e suas repetições?"
            : "Cancelar este compromisso e todas as suas repetições?",
      )
    )
      return;
    const candidate = {
      ...event,
      status: event.status === "scheduled" ? "cancelled" : "scheduled",
    } as Appointment;
    if (!remove && findConflict(candidate, events)) {
      setError("Não é possível reativar: existe conflito de horários.");
      return;
    }
    setSaving(true);
    try {
      await mutate(remove ? "DELETE" : "PUT", remove ? event : candidate);
      setNotice(remove ? "Compromisso excluído." : "Status atualizado.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    setMonth(dateKey(date).slice(0, 7));
  }
  const label = (
    day: string,
    options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
  ) =>
    day ? new Date(day + "T12:00:00").toLocaleDateString("pt-BR", options) : "";
  function card(event: Appointment, day?: string) {
    return (
      <article
        className={`event-card ${event.category !== "Atendimento" ? "personal" : ""} ${event.status === "cancelled" ? "cancelled" : ""}`}
        key={event.id + (day ?? "")}
      >
        <div className="event-time">
          {day ? (
            <span>{label(day, { day: "2-digit", month: "short" })}</span>
          ) : (
            <>
              <strong>{event.time}</strong>
              <span>{event.duration} min</span>
            </>
          )}
        </div>
        <div className="event-main">
          <div className="event-heading">
            <h3>{event.title}</h3>
            <span
              className={`badge ${event.category !== "Atendimento" ? "lavender" : ""}`}
            >
              {event.category}
            </span>
          </div>
          <p>
            <Clock3 size={13} />
            {day ? event.time + " · " : ""}
            {event.recurrence === "none"
              ? "Compromisso único"
              : recurrenceLabels[event.recurrence]}
            {event.location && (
              <>
                <span className="dot">·</span>
                <MapPin size={13} />
                {event.location}
              </>
            )}
          </p>
          {event.status === "cancelled" && (
            <span className="cancel-label">Cancelado · toda a série</span>
          )}
        </div>
        <div className="event-actions">
          <button
            title="Editar compromisso"
            aria-label={`Editar ${event.title}`}
            onClick={() => open(event)}
          >
            <Pencil size={16} />
          </button>
          <button
            disabled={saving}
            title={event.status === "cancelled" ? "Reativar" : "Cancelar"}
            aria-label={`Alterar status de ${event.title}`}
            onClick={() => action(event, false)}
          >
            <Ban size={16} />
          </button>
          <button
            disabled={saving}
            title="Excluir compromisso"
            aria-label={`Excluir ${event.title}`}
            onClick={() => action(event, true)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </article>
    );
  }
  if (!today)
    return <div className="initial-loading">Preparando sua agenda…</div>;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-icon">
            <CalendarCheck2 size={25} />
          </span>
          Agendarober<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">SEU ESPAÇO</div>
        <nav>
          {(
            [
              { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
              { id: "calendar", label: "Calendário", icon: CalendarDays },
              { id: "list", label: "Compromissos", icon: List },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "nav-active" : ""}
              onClick={() => setView(item.id)}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>Um dia de cada vez.</span>
          <p>
            Mais organização,
            <br />
            mais tempo para você.
          </p>
          <CalendarDays size={42} strokeWidth={1} />
        </div>
        <div className="profile">
          <div className="avatar">R</div>
          <div>
            <strong>Minha agenda</strong>
            <span>{demo ? "Modo demonstração" : "Acesso privado"}</span>
          </div>
          {!demo && (
            <form action="/auth/signout" method="post">
              <button aria-label="Sair">
                <LogOut size={18} />
              </button>
            </form>
          )}
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>Seu dia, com mais leveza</span>
          <span className="top-date">
            <CalendarDays size={15} />
            {label(today, { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">VAMOS ORGANIZAR O DIA</p>
              <h1>
                {view === "dashboard"
                  ? "Tudo no seu tempo."
                  : view === "calendar"
                    ? "Seu mês, em perspectiva."
                    : "Seus compromissos."}
              </h1>
              <p className="subtitle">
                {view === "dashboard"
                  ? "Um olhar tranquilo para o que vem pela frente."
                  : "Espaço para o trabalho e para cuidar de você."}
              </p>
            </div>
            <button
              className="primary"
              onClick={() => open()}
              disabled={(!!error && !demo) || loading}
            >
              <Plus size={18} />
              Novo compromisso
            </button>
          </div>
          {demo && (
            <div className="demo-banner">
              <span className="status-dot" />
              <span>
                <strong>Você está no modo demonstração.</strong> Dados
                fictícios; alterações são descartadas ao recarregar. Não insira
                dados reais.
              </span>
            </div>
          )}
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button onClick={() => location.reload()}>
                Tentar novamente
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button onClick={() => setNotice("")} aria-label="Fechar aviso">
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="panel empty">Carregando sua agenda privada…</div>
          ) : (
            <>
              {view === "dashboard" && (
                <div className="stats">
                  <div className="stat">
                    <span className="stat-icon">
                      <CalendarDays size={22} />
                    </span>
                    <div>
                      <p>Compromissos hoje</p>
                      <strong>
                        {todayEvents.length.toString().padStart(2, "0")}
                      </strong>
                      <span>Seu dia organizado</span>
                    </div>
                  </div>
                  <div className="stat">
                    <span className="stat-icon blue">
                      <Clock3 size={22} />
                    </span>
                    <div>
                      <p>Atendimentos hoje</p>
                      <strong>
                        {todayEvents
                          .filter((e) => e.category === "Atendimento")
                          .length.toString()
                          .padStart(2, "0")}
                      </strong>
                      <span>Tempo para o profissional</span>
                    </div>
                  </div>
                  <div className="stat">
                    <span className="stat-icon purple">
                      <CalendarCheck2 size={22} />
                    </span>
                    <div>
                      <p>Vida pessoal</p>
                      <strong>
                        {todayEvents
                          .filter((e) => e.category !== "Atendimento")
                          .length.toString()
                          .padStart(2, "0")}
                      </strong>
                      <span>Tempo para você</span>
                    </div>
                  </div>
                </div>
              )}
              <div className={view === "dashboard" ? "dashboard-grid" : ""}>
                <section className="panel agenda-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        {view === "calendar"
                          ? "Calendário mensal"
                          : view === "list"
                            ? "Todos os compromissos"
                            : "Agenda do dia"}
                      </h2>
                      <p>
                        {view === "list"
                          ? "Edite, cancele ou exclua uma série completa."
                          : label(selected, {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })}
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        setSelected(today);
                        setMonth(today.slice(0, 7));
                      }}
                    >
                      Hoje
                    </button>
                  </div>
                  {view === "calendar" && (
                    <>
                      <div className="month-heading">
                        <button
                          aria-label="Mês anterior"
                          onClick={() => shiftMonth(-1)}
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <strong>
                          {label(month + "-01", {
                            month: "long",
                            year: "numeric",
                          })}
                        </strong>
                        <button
                          aria-label="Próximo mês"
                          onClick={() => shiftMonth(1)}
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                      <div className="calendar-grid">
                        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
                          (d) => (
                            <span className="weekday" key={d}>
                              {d}
                            </span>
                          ),
                        )}
                        {(() => {
                          const [y, m] = month.split("-").map(Number);
                          const start = new Date(y, m - 1, 1).getDay();
                          return Array.from(
                            { length: start + new Date(y, m, 0).getDate() },
                            (_, i) => {
                              const d = i - start + 1;
                              if (d < 1) return <span key={i} />;
                              const key = `${month}-${String(d).padStart(2, "0")}`;
                              const count = dailyEvents(events, key).length;
                              return (
                                <button
                                  aria-label={`${label(key)}: ${count} compromissos`}
                                  aria-pressed={key === selected}
                                  className={`${key === selected ? "selected" : ""} ${key === today ? "is-today" : ""}`}
                                  key={i}
                                  onClick={() => setSelected(key)}
                                >
                                  {d}
                                  {count > 0 && (
                                    <span className="calendar-count">
                                      {count}
                                    </span>
                                  )}
                                </button>
                              );
                            },
                          );
                        })()}
                      </div>
                    </>
                  )}
                  <div className="agenda-tools">
                    <label className="date-picker">
                      <CalendarDays size={16} />
                      <input
                        aria-label="Data da agenda"
                        type="date"
                        value={selected}
                        onChange={(e) => {
                          if (e.target.value) {
                            setSelected(e.target.value);
                            setMonth(e.target.value.slice(0, 7));
                          }
                        }}
                      />
                    </label>
                    <select
                      aria-label="Filtrar categoria"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option>Todas</option>
                      {categories.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <div className="event-list">
                    {view === "list"
                      ? events
                          .filter(
                            (e) => filter === "Todas" || e.category === filter,
                          )
                          .sort((a, b) =>
                            (a.date + a.time).localeCompare(b.date + b.time),
                          )
                          .map((e) => card(e, e.date))
                      : dayEvents.map((e) => card(e))}
                    {(view === "list"
                      ? events.filter(
                          (e) => filter === "Todas" || e.category === filter,
                        )
                      : dayEvents
                    ).length === 0 && (
                      <div className="empty">
                        <CalendarCheck2 size={34} />
                        <h3>Um espaço livre na agenda</h3>
                        <p>Adicione um compromisso quando precisar.</p>
                      </div>
                    )}
                  </div>
                  <div className="panel-footer">
                    <span>
                      <span className="legend-dot" />
                      Atendimento <span className="legend-dot personal-dot" />
                      Demais categorias
                    </span>
                    <button className="text-button" onClick={() => open()}>
                      <Plus size={15} />
                      Adicionar
                    </button>
                  </div>
                </section>
                {view === "dashboard" && (
                  <aside className="right-column">
                    <section className="share-panel">
                      <div className="share-icon">
                        <MessageCircle size={24} />
                      </div>
                      <span className="eyebrow">SUA ROTINA, À MÃO</span>
                      <h2>
                        Leve sua agenda
                        <br />
                        para o WhatsApp.
                      </h2>
                      <p>
                        Gere o resumo da data selecionada e compartilhe quando
                        quiser.
                      </p>
                      <button onClick={() => setSummary(true)}>
                        Gerar resumo do dia
                        <ArrowUpRight size={17} />
                      </button>
                      <small>Você revisa e envia manualmente.</small>
                    </section>
                    <section className="panel upcoming">
                      <h2>Próximos compromissos</h2>
                      <p className="muted">Nos próximos 30 dias</p>
                      {upcoming.length ? (
                        upcoming.map(({ day, event }) => (
                          <button
                            className="upcoming-item"
                            key={event.id + day}
                            onClick={() => {
                              setSelected(day);
                              setMonth(day.slice(0, 7));
                              setView("calendar");
                            }}
                          >
                            <span className="date-tile">
                              <strong>{day.slice(8)}</strong>
                              {label(day, { month: "short" }).replace(".", "")}
                            </span>
                            <span>
                              <strong>{event.title}</strong>
                              <small>
                                {event.time} · {event.category}
                              </small>
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="muted">Nenhum compromisso previsto.</p>
                      )}
                    </section>
                  </aside>
                )}
              </div>
              {view !== "dashboard" && (
                <button
                  className="secondary summary-bottom"
                  onClick={() => setSummary(true)}
                >
                  <MessageCircle size={18} />
                  Gerar resumo da data selecionada
                </button>
              )}
            </>
          )}
          <footer className="page-footer">
            Agendarober{" "}
            <span>Uma rotina mais leve começa com organização.</span>
          </footer>
        </div>
      </main>
      {form && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="form-title"
            className="modal"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">SUA AGENDA</p>
                <h2 id="form-title">
                  {editing ? "Editar compromisso" : "Novo compromisso"}
                </h2>
              </div>
              <button
                disabled={saving}
                aria-label="Fechar formulário"
                onClick={() => setForm(null)}
              >
                <X />
              </button>
            </div>
            <form onSubmit={save}>
              <p className="form-help">
                {editing
                  ? "As alterações se aplicam a toda a série."
                  : "Organize os detalhes e deixe o resto com a agenda."}
              </p>
              <label>
                Título
                <input
                  autoFocus
                  required
                  maxLength={160}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Como se chama o compromisso?"
                />
              </label>
              <div className="form-row">
                <label>
                  Categoria
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        category: e.target.value as EventInput["category"],
                      })
                    }
                  >
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Repetição
                  <select
                    value={form.recurrence}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        recurrence: e.target.value as EventInput["recurrence"],
                      })
                    }
                  >
                    {Object.entries(recurrenceLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-row thirds">
                <label>
                  Data
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </label>
                <label>
                  Horário
                  <input
                    required
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </label>
                <label>
                  Duração (min)
                  <input
                    required
                    type="number"
                    min={5}
                    max={1440}
                    value={form.duration}
                    onChange={(e) =>
                      setForm({ ...form, duration: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <label>
                Local ou link <span>(opcional)</span>
                <input
                  maxLength={500}
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  placeholder="Endereço ou link da chamada"
                />
              </label>
              <label>
                Observação <span>(opcional)</span>
                <textarea
                  maxLength={2000}
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Algo que você precisa lembrar…"
                />
              </label>
              {form.recurrence === "monthly" && (
                <p className="form-help">
                  Em meses mais curtos, a repetição acontece no último dia do
                  mês.
                </p>
              )}
              {formError && (
                <p role="alert" className="form-error">
                  {formError}
                </p>
              )}
              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary"
                  disabled={saving}
                  onClick={() => setForm(null)}
                >
                  Voltar
                </button>
                <button className="primary" disabled={saving}>
                  <Check size={17} />
                  {saving ? "Salvando…" : "Salvar compromisso"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {summary && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="summary-title"
            className="modal"
          >
            <div className="modal-header">
              <h2 id="summary-title">Resumo para WhatsApp</h2>
              <button
                autoFocus
                aria-label="Fechar resumo"
                onClick={() => setSummary(false)}
              >
                <X />
              </button>
            </div>
            <p className="form-help">
              Revise antes de compartilhar. O envio é sempre manual.
            </p>
            <textarea
              className="summary-text"
              aria-label="Mensagem da agenda"
              readOnly
              value={agendaText(events, selected)}
              rows={10}
            />
            <div className="modal-footer">
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      agendaText(events, selected),
                    );
                    setNotice("Mensagem copiada.");
                  } catch {
                    setNotice(
                      "Não foi possível copiar. Selecione e copie o texto manualmente.",
                    );
                  }
                }}
              >
                <Copy size={17} />
                Copiar mensagem
              </button>
              <a
                className="primary"
                href={`https://wa.me/?text=${encodeURIComponent(agendaText(events, selected))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={17} />
                Abrir WhatsApp
              </a>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
