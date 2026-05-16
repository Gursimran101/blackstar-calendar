export type CalendarView = "year" | "month" | "week" | "day";

export type ReminderOffset = "none" | "5m" | "10m" | "30m" | "1h" | "1d";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
  color: string;
  reminder: ReminderOffset;
  createdAt: string;
  updatedAt: string;
};

export type DeletedCalendarEvent = CalendarEvent & {
  deletedAt: string;
};

export type CalendarStorageV1 = {
  version: 1;
  events: CalendarEvent[];
  trash?: DeletedCalendarEvent[];
};

export type CalendarState = {
  events: CalendarEvent[];
  trash: DeletedCalendarEvent[];
};

export type ThemePreference = "light" | "dark";

export type DraftEvent = Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">;
