import {
  addDays,
  addMinutes,
  differenceInMinutes,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { CalendarEvent, CalendarView } from "./types";

export const WEEK_STARTS_ON = 0;

export const monthGridDays = (monthDate: Date): Date[] => {
  const gridStart = startOfWeek(startOfMonth(monthDate), {
    weekStartsOn: WEEK_STARTS_ON,
  });

  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
};

export const weekDays = (date: Date): Date[] => {
  const start = startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
  const end = endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
  return eachDayOfInterval({ start, end });
};

export const eventStartsOnDay = (event: CalendarEvent, day: Date): boolean =>
  isSameDay(parseISO(event.start), day);

export const eventIntersectsDay = (event: CalendarEvent, day: Date): boolean => {
  const start = parseISO(event.start);
  const end = parseISO(event.end);
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  return isBefore(start, dayEnd) && isAfter(end, dayStart);
};

export const eventsForDay = (
  events: CalendarEvent[],
  day: Date,
): CalendarEvent[] =>
  events
    .filter((event) => eventIntersectsDay(event, day))
    .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime());

export const visibleTitle = (view: CalendarView, date: Date): string => {
  if (view === "year") {
    return format(date, "yyyy");
  }

  if (view === "month") {
    return format(date, "MMMM yyyy");
  }

  if (view === "day") {
    return format(date, "EEEE, MMMM d, yyyy");
  }

  const days = weekDays(date);
  const first = days[0];
  const last = days[6];

  if (isSameMonth(first, last)) {
    return `${format(first, "MMM d")} - ${format(last, "d, yyyy")}`;
  }

  return `${format(first, "MMM d")} - ${format(last, "MMM d, yyyy")}`;
};

export const formatDateInput = (date: Date): string => format(date, "yyyy-MM-dd");

export const formatTimeInput = (date: Date): string => format(date, "HH:mm");

export const parseLocalDateTime = (date: string, time: string): Date =>
  new Date(`${date}T${time}:00`);

export const minutesFromStartOfDay = (date: Date): number =>
  differenceInMinutes(date, startOfDay(date));

export const clampEventMinutes = (
  event: CalendarEvent,
  day: Date,
): { start: number; duration: number } => {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const rawStart = parseISO(event.start);
  const rawEnd = parseISO(event.end);
  const start = isBefore(rawStart, dayStart) ? dayStart : rawStart;
  const end = isAfter(rawEnd, dayEnd) ? dayEnd : rawEnd;
  const startMinutes = minutesFromStartOfDay(start);
  const duration = Math.max(30, differenceInMinutes(end, start));

  return { start: startMinutes, duration };
};

export const defaultEventEnd = (start: Date): Date => addMinutes(start, 60);
