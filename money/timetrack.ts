import type { Task } from "./execute";

export interface TimeEntry {
  taskId: string;
  taskType: string;
  description: string;
  startTime: number;
  endTime?: number;
  durationMs: number;
  billable: boolean;
}

export interface TimeTracker {
  entries: TimeEntry[];
  activeTaskId: string | null;
}

export function createTracker(): TimeTracker {
  return { entries: [], activeTaskId: null };
}

export function startTracking(tracker: TimeTracker, task: Task): TimeTracker {
  if (tracker.activeTaskId) {
    throw new Error(`Already tracking task ${tracker.activeTaskId}. Stop first.`);
  }
  return {
    ...tracker,
    activeTaskId: task.id,
    entries: [
      ...tracker.entries,
      {
        taskId: task.id,
        taskType: task.type,
        description: task.description,
        startTime: Date.now(),
        durationMs: 0,
        billable: true,
      },
    ],
  };
}

export function stopTracking(tracker: TimeTracker): { tracker: TimeTracker; entry: TimeEntry } {
  if (!tracker.activeTaskId) {
    throw new Error("No active task to stop.");
  }
  const now = Date.now();
  let stoppedEntry: TimeEntry = {} as TimeEntry;

  const entries = tracker.entries.map((e) => {
    if (e.taskId === tracker.activeTaskId && !e.endTime) {
      stoppedEntry = { ...e, endTime: now, durationMs: now - e.startTime };
      return stoppedEntry;
    }
    return e;
  });

  return {
    tracker: { entries, activeTaskId: null },
    entry: stoppedEntry,
  };
}

export function getBillableEntries(tracker: TimeTracker): TimeEntry[] {
  return tracker.entries.filter((e) => e.billable && e.endTime);
}

export function getTotalBillableMs(tracker: TimeTracker): number {
  return getBillableEntries(tracker).reduce((sum, e) => sum + e.durationMs, 0);
}

export function getTotalBillableHours(tracker: TimeTracker): number {
  return Math.round((getTotalBillableMs(tracker) / 3_600_000) * 100) / 100;
}

export function getEntriesByType(tracker: TimeTracker, type: string): TimeEntry[] {
  return tracker.entries.filter((e) => e.taskType === type && e.endTime);
}
