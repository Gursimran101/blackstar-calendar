import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
  startOfMonth,
  startOfYear,
} from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Grip,
  MapPin,
  Menu,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  clampEventMinutes,
  defaultEventEnd,
  eventIntersectsDay,
  eventsForDay,
  formatDateInput,
  formatTimeInput,
  layoutEvents,
  monthGridDays,
  parseLocalDateTime,
  visibleTitle,
  weekDays,
} from "./dateUtils";
import { loadCalendarState, loadTheme, saveCalendar, saveTheme } from "./storage";
import type {
  CalendarEvent,
  CalendarView,
  DeletedCalendarEvent,
  ReminderOffset,
  ThemePreference,
} from "./types";

const EVENT_COLORS = ["#73d39b", "#f4c95d", "#8fb5ff", "#ff8a80", "#c9a7ff"];

const REMINDER_LABELS: Record<ReminderOffset, string> = {
  none: "None",
  "5m": "5 minutes before",
  "10m": "10 minutes before",
  "30m": "30 minutes before",
  "1h": "1 hour before",
  "1d": "1 day before",
};

type EventSeed = {
  date: Date;
  event?: CalendarEvent;
};

type EventFormState = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string;
  description: string;
  color: string;
  reminder: ReminderOffset;
};

const createId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const nearestDefaultStart = (date: Date): Date => {
  const withHour = setMinutes(setHours(date, 9), 0);
  return withHour;
};

const makeFormState = (seed: EventSeed): EventFormState => {
  if (seed.event) {
    const start = parseISO(seed.event.start);
    const end = parseISO(seed.event.end);

    return {
      title: seed.event.title,
      date: formatDateInput(start),
      startTime: formatTimeInput(start),
      endTime: formatTimeInput(end),
      allDay: seed.event.allDay,
      location: seed.event.location ?? "",
      description: seed.event.description ?? "",
      color: seed.event.color,
      reminder: seed.event.reminder,
    };
  }

  const start = nearestDefaultStart(seed.date);
  const end = defaultEventEnd(start);

  return {
    title: "",
    date: formatDateInput(start),
    startTime: formatTimeInput(start),
    endTime: formatTimeInput(end),
    allDay: false,
    location: "",
    description: "",
    color: EVENT_COLORS[0],
    reminder: "30m",
  };
};

const moveFocus = (date: Date, view: CalendarView, direction: -1 | 1): Date => {
  if (view === "year") {
    return addYears(date, direction);
  }

  if (view === "month") {
    return addMonths(date, direction);
  }

  if (view === "week") {
    return addWeeks(date, direction);
  }

  return addDays(date, direction);
};

const getStoredView = (): CalendarView => {
  if (typeof window === "undefined") {
    return "year";
  }

  const value = window.localStorage.getItem("blackstar-calendar:view");
  return value === "month" || value === "week" || value === "day" || value === "year"
    ? value
    : "week";
};

export function App() {
  const [initialCalendarState] = useState(() => loadCalendarState());
  const [events, setEvents] = useState<CalendarEvent[]>(initialCalendarState.events);
  const [trash, setTrash] = useState<DeletedCalendarEvent[]>(initialCalendarState.trash);
  const [view, setView] = useState<CalendarView>(() => getStoredView());
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [modalSeed, setModalSeed] = useState<EventSeed | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(() => loadTheme());

  useEffect(() => {
    saveCalendar(events, trash);
  }, [events, trash]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("blackstar-calendar:view", view);
  }, [view]);

  const openCreate = (date = focusDate) => {
    setModalSeed({ date });
  };

  const openEdit = (event: CalendarEvent) => {
    setModalSeed({ date: parseISO(event.start), event });
  };

  const upsertEvent = (event: CalendarEvent) => {
    setEvents((current) => {
      const exists = current.some((candidate) => candidate.id === event.id);
      const next = exists
        ? current.map((candidate) => (candidate.id === event.id ? event : candidate))
        : [...current, event];

      return next.sort(
        (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime(),
      );
    });
  };

  const deleteEvent = (eventId: string) => {
    const event = events.find((candidate) => candidate.id === eventId);

    if (!event) {
      return;
    }

    setEvents((current) => current.filter((event) => event.id !== eventId));
    setTrash((current) => [
      { ...event, deletedAt: new Date().toISOString() },
      ...current.filter((candidate) => candidate.id !== eventId),
    ]);
  };

  const restoreEvent = (eventId: string) => {
    const deletedEvent = trash.find((candidate) => candidate.id === eventId);

    if (!deletedEvent) {
      return;
    }

    const { deletedAt: _deletedAt, ...event } = deletedEvent;
    const restoredEvent = { ...event, updatedAt: new Date().toISOString() };

    setTrash((current) => current.filter((candidate) => candidate.id !== eventId));
    setEvents((current) =>
      [...current.filter((candidate) => candidate.id !== eventId), restoredEvent].sort(
        (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime(),
      ),
    );
  };

  return (
    <div className="app-shell">
      <Header
        view={view}
        focusDate={focusDate}
        onToday={() => setFocusDate(new Date())}
        onPrevious={() => setFocusDate((date) => moveFocus(date, view, -1))}
        onNext={() => setFocusDate((date) => moveFocus(date, view, 1))}
        onViewChange={setView}
        onMenuToggle={() => setSidebarOpen((open) => !open)}
        sidebarOpen={sidebarOpen}
        onSettingsOpen={() => setSettingsOpen(true)}
      />
      <div className={sidebarOpen ? "workspace" : "workspace sidebar-collapsed"}>
        {sidebarOpen && (
          <Sidebar
            focusDate={focusDate}
            events={events}
            onCreate={() => openCreate()}
            onDateSelect={(date) => {
              setFocusDate(date);
              setView("day");
            }}
          />
        )}
        <main className="calendar-surface">
          {view === "year" && (
            <YearView
              focusDate={focusDate}
              events={events}
              onDateSelect={(date) => {
                setFocusDate(date);
                setView("day");
              }}
              onCreate={openCreate}
            />
          )}
          {view === "month" && (
            <MonthView
              focusDate={focusDate}
              events={events}
              onDateSelect={setFocusDate}
              onCreate={openCreate}
              onEdit={openEdit}
            />
          )}
          {view === "week" && (
            <TimeGridView
              days={weekDays(focusDate)}
              events={events}
              onCreate={openCreate}
              onEdit={openEdit}
            />
          )}
          {view === "day" && (
            <TimeGridView
              days={[focusDate]}
              events={events}
              onCreate={openCreate}
              onEdit={openEdit}
            />
          )}
        </main>
      </div>
      {modalSeed && (
        <EventDialog
          seed={modalSeed}
          onClose={() => setModalSeed(null)}
          onSave={(event) => {
            upsertEvent(event);
            setModalSeed(null);
          }}
          onDelete={(eventId) => {
            deleteEvent(eventId);
            setModalSeed(null);
          }}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          theme={theme}
          trash={trash}
          onClose={() => setSettingsOpen(false)}
          onThemeChange={setTheme}
          onRestore={restoreEvent}
          onDeleteForever={(eventId) =>
            setTrash((current) => current.filter((event) => event.id !== eventId))
          }
          onEmptyTrash={() => setTrash([])}
        />
      )}
    </div>
  );
}

function Header({
  view,
  focusDate,
  onToday,
  onPrevious,
  onNext,
  onViewChange,
  onMenuToggle,
  sidebarOpen,
  onSettingsOpen,
}: {
  view: CalendarView;
  focusDate: Date;
  onToday: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onViewChange: (view: CalendarView) => void;
  onMenuToggle: () => void;
  sidebarOpen: boolean;
  onSettingsOpen: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand-block">
        <button
          className="icon-button"
          type="button"
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={sidebarOpen}
          onClick={onMenuToggle}
        >
          <Menu size={24} />
        </button>
        <div className="blackstar-lockup" aria-label="Blackstar Calendar">
          <span className="star-mark" aria-hidden="true" />
          <span className="wordmark">BLACKSTAR</span>
        </div>
        <span className="product-name">Calendar</span>
      </div>

      <div className="period-controls">
        <button className="outline-button" type="button" onClick={onToday}>
          Today
        </button>
        <button className="icon-button" type="button" onClick={onPrevious} aria-label="Previous">
          <ChevronLeft size={22} />
        </button>
        <button className="icon-button" type="button" onClick={onNext} aria-label="Next">
          <ChevronRight size={22} />
        </button>
        <h1>{visibleTitle(view, focusDate)}</h1>
      </div>

      <div className="topbar-tools">
        <button className="icon-button optional-tool" aria-label="Search">
          <Search size={21} />
        </button>
<button className="icon-button" type="button" onClick={onSettingsOpen} aria-label="Settings">
          <Settings size={21} />
        </button>
        <label className="view-select">
          <select
            value={view}
            onChange={(event) => onViewChange(event.target.value as CalendarView)}
            aria-label="Calendar view"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
          <ChevronDown size={16} />
        </label>
        <div className="mode-pill" aria-hidden="true">
          <span className="active">
            <CalendarDays size={19} />
          </span>
          <span>
            <CheckCircle2 size={20} />
          </span>
        </div>
        <button className="icon-button optional-tool" aria-label="Apps">
          <Grip size={22} />
        </button>
      </div>
    </header>
  );
}

function Sidebar({
  focusDate,
  events,
  onCreate,
  onDateSelect,
}: {
  focusDate: Date;
  events: CalendarEvent[];
  onCreate: () => void;
  onDateSelect: (date: Date) => void;
}) {
  const upcoming = events
    .filter((event) => parseISO(event.end) >= startOfDay(new Date()))
    .slice(0, 3);

  return (
    <aside className="sidebar">
      <button className="create-button" type="button" onClick={onCreate}>
        <Plus size={28} />
        <span>Create</span>
        <ChevronDown size={16} />
      </button>

      <MiniCalendar focusDate={focusDate} onDateSelect={onDateSelect} />

      <section className="sidebar-section">
        <div className="section-title">Meet with...</div>
        <label className="people-search">
          <Users size={18} />
          <input type="text" placeholder="Search for people" aria-label="Search for people" />
        </label>
      </section>

      <section className="sidebar-section">
        <div className="section-heading">
          <span>Upcoming</span>
          <ChevronDown size={18} />
        </div>
        <div className="upcoming-list">
          {upcoming.length === 0 && <span className="muted-small">No meetings scheduled</span>}
          {upcoming.map((event) => (
            <div className="upcoming-item" key={event.id}>
              <span className="event-dot" style={{ backgroundColor: event.color }} />
              <span>{event.title}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sidebar-section">
        <div className="section-heading">
          <span>My calendars</span>
          <ChevronDown size={18} />
        </div>
        <CalendarToggle color="#73d39b" label="Gursimran Panesar" />
        <CalendarToggle color="#f4c95d" label="Birthdays" />
        <CalendarToggle color="#8fb5ff" label="Tasks" />
      </section>

      <section className="sidebar-section">
        <div className="section-heading">
          <span>Other calendars</span>
          <ChevronDown size={18} />
        </div>
        <CalendarToggle color="#73d39b" label="Holidays in United States" />
      </section>
    </aside>
  );
}

function CalendarToggle({ color, label }: { color: string; label: string }) {
  return (
    <label className="calendar-toggle">
      <span className="check-swatch" style={{ backgroundColor: color }}>
        <CheckCircle2 size={13} />
      </span>
      <span>{label}</span>
    </label>
  );
}

function MiniCalendar({
  focusDate,
  onDateSelect,
}: {
  focusDate: Date;
  onDateSelect: (date: Date) => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(focusDate));

  useEffect(() => {
    setVisibleMonth(startOfMonth(focusDate));
  }, [focusDate]);

  return (
    <section className="mini-calendar">
      <div className="mini-header">
        <span>{format(visibleMonth, "MMMM yyyy")}</span>
        <div>
          <button
            className="mini-nav"
            type="button"
            onClick={() => setVisibleMonth((date) => addMonths(date, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="mini-nav"
            type="button"
            onClick={() => setVisibleMonth((date) => addMonths(date, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <MiniMonthGrid
        monthDate={visibleMonth}
        events={[]}
        compact
        onDateSelect={onDateSelect}
        onCreate={onDateSelect}
      />
    </section>
  );
}

function YearView({
  focusDate,
  events,
  onDateSelect,
  onCreate,
}: {
  focusDate: Date;
  events: CalendarEvent[];
  onDateSelect: (date: Date) => void;
  onCreate: (date: Date) => void;
}) {
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, index) => addMonths(startOfYear(focusDate), index)),
    [focusDate],
  );

  return (
    <section className="year-view" aria-label={`${format(focusDate, "yyyy")} calendar`}>
      {months.map((month) => (
        <div className="year-month" key={month.toISOString()}>
          <h2>{format(month, "MMMM")}</h2>
          <MiniMonthGrid
            monthDate={month}
            events={events}
            onDateSelect={onDateSelect}
            onCreate={onCreate}
          />
        </div>
      ))}
    </section>
  );
}

function MiniMonthGrid({
  monthDate,
  events,
  compact = false,
  onDateSelect,
  onCreate,
}: {
  monthDate: Date;
  events: CalendarEvent[];
  compact?: boolean;
  onDateSelect: (date: Date) => void;
  onCreate: (date: Date) => void;
}) {
  const days = monthGridDays(monthDate);
  const clickTimer = useRef<number | null>(null);

  const handleDayClick = (day: Date) => {
    if (compact) {
      onDateSelect(day);
      return;
    }

    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
    }

    clickTimer.current = window.setTimeout(() => {
      onDateSelect(day);
      clickTimer.current = null;
    }, 180);
  };

  const handleDayDoubleClick = (day: Date) => {
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }

    onCreate(day);
  };

  return (
    <div className={compact ? "month-mini compact" : "month-mini"}>
      {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
        <span className="weekday" key={`${day}-${index}`}>
          {day}
        </span>
      ))}
      {days.map((day) => {
        const dayEvents = events.filter((event) => eventIntersectsDay(event, day));
        const outside = !isSameMonth(day, monthDate);

        return (
          <button
            className={[
              "mini-day",
              outside ? "outside" : "",
              isToday(day) ? "today" : "",
              dayEvents.length > 0 ? "has-event" : "",
            ].join(" ")}
            key={day.toISOString()}
            type="button"
            onClick={() => handleDayClick(day)}
            onDoubleClick={() => handleDayDoubleClick(day)}
            aria-label={`${format(day, "EEEE, MMMM d")}${
              dayEvents.length ? `, ${dayEvents.length} events` : ""
            }`}
          >
            <span>{format(day, "d")}</span>
            {dayEvents.length > 0 && <i aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

function MonthView({
  focusDate,
  events,
  onDateSelect,
  onCreate,
  onEdit,
}: {
  focusDate: Date;
  events: CalendarEvent[];
  onDateSelect: (date: Date) => void;
  onCreate: (date: Date) => void;
  onEdit: (event: CalendarEvent) => void;
}) {
  const days = monthGridDays(focusDate);

  return (
    <section className="month-view" aria-label={format(focusDate, "MMMM yyyy")}>
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
        <div className="month-weekday" key={day}>
          {day}
        </div>
      ))}
      {days.map((day) => {
        const dayEvents = eventsForDay(events, day);
        const visibleEvents = dayEvents.slice(0, 3);
        const hiddenCount = dayEvents.length - visibleEvents.length;

        return (
          <button
            className={[
              "month-cell",
              !isSameMonth(day, focusDate) ? "outside" : "",
              isToday(day) ? "today" : "",
            ].join(" ")}
            key={day.toISOString()}
            type="button"
            onClick={() => onDateSelect(day)}
            onDoubleClick={() => onCreate(day)}
          >
            <span className="month-date">{format(day, "d")}</span>
            <div className="month-events">
              {visibleEvents.map((event) => (
                <span
                  className="event-chip"
                  key={event.id}
                  style={{ borderColor: event.color }}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    onEdit(event);
                  }}
                >
                  <span style={{ backgroundColor: event.color }} />
                  {event.title}
                </span>
              ))}
              {hiddenCount > 0 && <span className="more-events">+{hiddenCount} more</span>}
            </div>
          </button>
        );
      })}
    </section>
  );
}

function TimeGridView({
  days,
  events,
  onCreate,
  onEdit,
}: {
  days: Date[];
  events: CalendarEvent[];
  onCreate: (date: Date) => void;
  onEdit: (event: CalendarEvent) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const isSingleDay = days.length === 1;

  return (
    <section className={isSingleDay ? "time-view day-mode" : "time-view"} aria-label="Schedule">
      <div className="time-header">
        <div className="time-gutter" />
        {days.map((day) => (
          <div className="time-day-heading" key={day.toISOString()}>
            <span>{format(day, "EEE")}</span>
            <strong className={isToday(day) ? "today-badge" : ""}>{format(day, "d")}</strong>
          </div>
        ))}
      </div>

      <div className="all-day-row">
        <div className="time-gutter all-day-label">All day</div>
        {days.map((day) => (
          <div className="all-day-cell" key={day.toISOString()}>
            {events
              .filter((event) => event.allDay && eventIntersectsDay(event, day))
              .map((event) => (
                <button
                  className="all-day-chip"
                  key={event.id}
                  type="button"
                  style={{ borderColor: event.color }}
                  onClick={() => onEdit(event)}
                >
                  {event.title}
                </button>
              ))}
          </div>
        ))}
      </div>

      <div className="time-grid">
        <div className="hour-labels">
          {hours.map((hour) => (
            <span key={hour}>{hour === 0 ? "" : format(setHours(new Date(), hour), "ha")}</span>
          ))}
        </div>
        {days.map((day) => {
          const dayEvents = eventsForDay(events, day).filter((event) => !event.allDay);
          const layouts = layoutEvents(dayEvents, day);

          return (
            <div className="day-column" key={day.toISOString()}>
              {hours.map((hour) => (
                <button
                  className="hour-slot"
                  type="button"
                  key={hour}
                  aria-label={`${format(day, "MMM d")} at ${hour}:00`}
                  onClick={() => onCreate(setMinutes(setHours(day, hour), 0))}
                />
              ))}
              {layouts.map(({ event, column, totalColumns }) => {
                const placement = clampEventMinutes(event, day);
                const top = (placement.start / 60) * 56;
                const height = (placement.duration / 60) * 56;

                return (
                  <button
                    className="time-event"
                    type="button"
                    key={event.id}
                    style={{
                      top,
                      height,
                      left: `calc(8px + ${column} * (100% - 16px) / ${totalColumns})`,
                      width: `calc((100% - 16px) / ${totalColumns} - 2px)`,
                      borderColor: event.color,
                      background: `linear-gradient(90deg, ${event.color} 0 5px, var(--time-event-fill) 5px)`,
                    }}
                    onClick={() => onEdit(event)}
                  >
                    <strong>{event.title}</strong>
                    <span>
                      {format(parseISO(event.start), "h:mm a")} -{" "}
                      {format(parseISO(event.end), "h:mm a")}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SettingsDialog({
  theme,
  trash,
  onClose,
  onThemeChange,
  onRestore,
  onDeleteForever,
  onEmptyTrash,
}: {
  theme: ThemePreference;
  trash: DeletedCalendarEvent[];
  onClose: () => void;
  onThemeChange: (theme: ThemePreference) => void;
  onRestore: (eventId: string) => void;
  onDeleteForever: (eventId: string) => void;
  onEmptyTrash: () => void;
}) {
  const sortedTrash = [...trash].sort(
    (a, b) => parseISO(b.deletedAt).getTime() - parseISO(a.deletedAt).getTime(),
  );

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="event-dialog settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 id="settings-dialog-title">Settings</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <section className="settings-section">
          <div className="settings-section-heading">
            <div>
              <h3>Appearance</h3>
              <p>Choose how Blackstar Calendar looks on this device.</p>
            </div>
          </div>
          <div className="appearance-options" role="group" aria-label="Appearance">
            <button
              className={theme === "dark" ? "appearance-option active" : "appearance-option"}
              type="button"
              onClick={() => onThemeChange("dark")}
            >
              <Moon size={19} />
              <span>Dark mode</span>
            </button>
            <button
              className={theme === "light" ? "appearance-option active" : "appearance-option"}
              type="button"
              onClick={() => onThemeChange("light")}
            >
              <Sun size={19} />
              <span>Light mode</span>
            </button>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-heading">
            <div>
              <h3>Trash</h3>
              <p>Deleted meetings stay here until you restore them or delete them forever.</p>
            </div>
            {sortedTrash.length > 0 && (
              <button className="text-danger-button" type="button" onClick={onEmptyTrash}>
                Empty trash
              </button>
            )}
          </div>

          <div className="trash-list">
            {sortedTrash.length === 0 && (
              <div className="empty-trash">
                <Trash2 size={22} />
                <span>Trash is empty</span>
              </div>
            )}
            {sortedTrash.map((event) => (
              <article className="trash-item" key={event.id}>
                <div className="trash-item-main">
                  <span className="event-dot" style={{ backgroundColor: event.color }} />
                  <div>
                    <h4>{event.title}</h4>
                    <p>
                      {format(parseISO(event.start), "MMM d, yyyy")}
                      {!event.allDay &&
                        `, ${format(parseISO(event.start), "h:mm a")} - ${format(
                          parseISO(event.end),
                          "h:mm a",
                        )}`}
                    </p>
                    <p>Deleted {format(parseISO(event.deletedAt), "MMM d, h:mm a")}</p>
                  </div>
                </div>
                <div className="trash-actions">
                  <button className="restore-button" type="button" onClick={() => onRestore(event.id)}>
                    <RotateCcw size={16} />
                    Restore
                  </button>
                  <button
                    className="text-danger-button"
                    type="button"
                    onClick={() => onDeleteForever(event.id)}
                  >
                    Delete forever
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function EventDialog({
  seed,
  onClose,
  onSave,
  onDelete,
}: {
  seed: EventSeed;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete: (eventId: string) => void;
}) {
  const [form, setForm] = useState<EventFormState>(() => makeFormState(seed));
  const [error, setError] = useState("");
  const editing = Boolean(seed.event);

  const updateForm = <TKey extends keyof EventFormState>(
    key: TKey,
    value: EventFormState[TKey],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!form.title.trim()) {
      setError("Add a title before saving.");
      return;
    }

    const start = form.allDay
      ? startOfDay(parseLocalDateTime(form.date, "00:00"))
      : parseLocalDateTime(form.date, form.startTime);
    const end = form.allDay
      ? endOfDay(start)
      : parseLocalDateTime(form.date, form.endTime);

    if (!form.allDay && end <= start) {
      setError("Choose an end time after the start time.");
      return;
    }

    const now = new Date().toISOString();
    const nextEvent: CalendarEvent = {
      id: seed.event?.id ?? createId(),
      title: form.title.trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: form.allDay,
      location: form.location.trim() || undefined,
      description: form.description.trim() || undefined,
      color: form.color,
      reminder: form.reminder,
      createdAt: seed.event?.createdAt ?? now,
      updatedAt: now,
    };

    onSave(nextEvent);
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="event-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-dialog-title"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <h2 id="event-dialog-title">{editing ? "Edit meeting" : "Create meeting"}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <label className="field title-field">
          <span>Title</span>
          <input
            autoFocus
            value={form.title}
            onChange={(event) => updateForm("title", event.target.value)}
            placeholder="Add title"
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={form.date}
              onChange={(event) => updateForm("date", event.target.value)}
            />
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(event) => updateForm("allDay", event.target.checked)}
            />
            <span>All day</span>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Start</span>
            <input
              type="time"
              value={form.startTime}
              disabled={form.allDay}
              onChange={(event) => updateForm("startTime", event.target.value)}
            />
          </label>
          <label className="field">
            <span>End</span>
            <input
              type="time"
              value={form.endTime}
              disabled={form.allDay}
              onChange={(event) => updateForm("endTime", event.target.value)}
            />
          </label>
        </div>

        <label className="field icon-field">
          <MapPin size={18} />
          <input
            value={form.location}
            onChange={(event) => updateForm("location", event.target.value)}
            placeholder="Add location"
          />
        </label>

        <label className="field icon-field">
          <Clock3 size={18} />
          <select
            value={form.reminder}
            onChange={(event) => updateForm("reminder", event.target.value as ReminderOffset)}
          >
            {(Object.keys(REMINDER_LABELS) as ReminderOffset[]).map((key) => (
              <option value={key} key={key}>
                {REMINDER_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="color-picker">
          <legend>Color</legend>
          {EVENT_COLORS.map((color) => (
            <button
              className={form.color === color ? "selected" : ""}
              type="button"
              key={color}
              style={{ backgroundColor: color }}
              onClick={() => updateForm("color", color)}
              aria-label={`Use ${color}`}
            />
          ))}
        </fieldset>

        <label className="field">
          <span>Description</span>
          <textarea
            value={form.description}
            onChange={(event) => updateForm("description", event.target.value)}
            placeholder="Add description"
            rows={3}
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="dialog-actions">
          {editing && seed.event && (
            <button
              className="danger-button"
              type="button"
              onClick={() => onDelete(seed.event!.id)}
            >
              <Trash2 size={17} />
              Delete
            </button>
          )}
          <button className="ghost-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="save-button" type="submit">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
