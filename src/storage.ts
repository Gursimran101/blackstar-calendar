import { addDays, addHours, setHours, setMinutes } from "date-fns";
import type {
  CalendarEvent,
  CalendarState,
  CalendarStorageV1,
  DeletedCalendarEvent,
  ThemePreference,
} from "./types";

export const STORAGE_KEY = "blackstar-calendar:v1";
export const THEME_KEY = "blackstar-calendar:theme";

const EVENT_COLORS = ["#73d39b", "#f4c95d", "#8fb5ff"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCalendarEvent = (value: unknown): value is CalendarEvent => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.start === "string" &&
    typeof value.end === "string" &&
    typeof value.allDay === "boolean" &&
    typeof value.color === "string" &&
    typeof value.reminder === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
};

const isDeletedCalendarEvent = (value: unknown): value is DeletedCalendarEvent =>
  isRecord(value) && typeof value["deletedAt"] === "string" && isCalendarEvent(value);

const seedEvents = (): CalendarEvent[] => {
  const now = new Date();
  const base = setMinutes(setHours(now, 10), 0);
  const second = setMinutes(setHours(addDays(now, 2), 14), 30);
  const createdAt = new Date().toISOString();

  return [
    {
      id: "seed-product-review",
      title: "Product review",
      start: base.toISOString(),
      end: addHours(base, 1).toISOString(),
      allDay: false,
      location: "Blackstar HQ",
      description: "Review launch notes and candidate demo polish.",
      color: EVENT_COLORS[0],
      reminder: "30m",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "seed-design-sync",
      title: "Design sync",
      start: second.toISOString(),
      end: addHours(second, 1).toISOString(),
      allDay: false,
      location: "Studio",
      description: "Calendar interaction pass.",
      color: EVENT_COLORS[2],
      reminder: "10m",
      createdAt,
      updatedAt: createdAt,
    },
  ];
};

export const loadCalendarState = (): CalendarState => {
  if (typeof window === "undefined") {
    return { events: [], trash: [] };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return { events: seedEvents(), trash: [] };
  }

  try {
    const parsed = JSON.parse(raw) as CalendarStorageV1;

    if (parsed.version !== 1 || !Array.isArray(parsed.events)) {
      return { events: [], trash: [] };
    }

    return {
      events: parsed.events.filter(isCalendarEvent),
      trash: Array.isArray(parsed.trash) ? parsed.trash.filter(isDeletedCalendarEvent) : [],
    };
  } catch {
    return { events: [], trash: [] };
  }
};

export const saveCalendar = (
  events: CalendarEvent[],
  trash: DeletedCalendarEvent[] = [],
): void => {
  if (typeof window === "undefined") {
    return;
  }

  const payload: CalendarStorageV1 = {
    version: 1,
    events,
    trash,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const loadTheme = (): ThemePreference => {
  if (typeof window === "undefined") {
    return "dark";
  }

  const value = window.localStorage.getItem(THEME_KEY);
  return value === "light" || value === "dark" ? value : "dark";
};

export const saveTheme = (theme: ThemePreference): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_KEY, theme);
};
