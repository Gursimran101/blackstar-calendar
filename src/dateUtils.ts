import {
  addDays,
  addMinutes,
  differenceInMinutes,
  eachDayOfInterval,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
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

  return format(date, "MMMM yyyy");
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

export type EventLayout = {
  event: CalendarEvent;
  column: number;
  totalColumns: number;
};

export const layoutEvents = (events: CalendarEvent[], day: Date): EventLayout[] => {
  if (events.length === 0) return [];

  const items = events.map((event) => {
    const p = clampEventMinutes(event, day);
    return { event, start: p.start, end: p.start + p.duration };
  });

  items.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const columns: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const used = new Set<number>();
    for (let j = 0; j < i; j++) {
      if (items[j].end > items[i].start) {
        used.add(columns[j]);
      }
    }
    let col = 0;
    while (used.has(col)) col++;
    columns[i] = col;
  }

  const parent = items.map((_, i) => i);
  const find = (x: number): number =>
    parent[x] === x ? x : (parent[x] = find(parent[x]));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].end > items[j].start) {
        union(i, j);
      }
    }
  }

  const groupMax = new Map<number, number>();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    groupMax.set(root, Math.max(groupMax.get(root) ?? 0, columns[i]));
  }

  return items.map((item, i) => ({
    event: item.event,
    column: columns[i],
    totalColumns: (groupMax.get(find(i)) ?? 0) + 1,
  }));
};
