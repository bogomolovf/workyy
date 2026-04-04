import { describe, expect, it } from 'vitest';

function midpoint(a: number | undefined, b: number | undefined): number {
  if (a != null && b != null) return (a + b) / 2;
  if (a != null) return a + 1;
  if (b != null) return b - 1;
  return 1;
}

function sortTasksWithCompleted<T extends { completedAt: string | null; position: number }>(
  tasks: T[],
): T[] {
  const active = tasks.filter((t) => !t.completedAt).sort((a, b) => a.position - b.position);
  const completed = tasks
    .filter((t) => !!t.completedAt)
    .sort((a, b) => {
      const aTime = new Date(a.completedAt!).getTime();
      const bTime = new Date(b.completedAt!).getTime();
      return bTime - aTime;
    });
  return [...active, ...completed];
}

describe('midpoint', () => {
  it('returns midpoint between two numbers', () => {
    expect(midpoint(1, 3)).toBe(2);
    expect(midpoint(0, 10)).toBe(5);
    expect(midpoint(1.5, 2.5)).toBe(2);
  });

  it('returns a+1 when only a is defined', () => {
    expect(midpoint(5, undefined)).toBe(6);
    expect(midpoint(0, undefined)).toBe(1);
  });

  it('returns b-1 when only b is defined', () => {
    expect(midpoint(undefined, 5)).toBe(4);
  });

  it('returns 1 when neither is defined', () => {
    expect(midpoint(undefined, undefined)).toBe(1);
  });

  it('handles close neighbors without colliding', () => {
    const result = midpoint(1.0, 1.001);
    expect(result).toBeGreaterThan(1.0);
    expect(result).toBeLessThan(1.001);
  });
});

describe('sortTasksWithCompleted', () => {
  it('puts completed tasks at the bottom', () => {
    const tasks = [
      { id: '1', position: 1, completedAt: null },
      { id: '2', position: 2, completedAt: '2024-01-01T00:00:00Z' },
      { id: '3', position: 3, completedAt: null },
    ];
    const sorted = sortTasksWithCompleted(tasks);
    expect(sorted.map((t) => t.id)).toEqual(['1', '3', '2']);
  });

  it('orders active tasks by position', () => {
    const tasks = [
      { id: 'a', position: 3, completedAt: null },
      { id: 'b', position: 1, completedAt: null },
      { id: 'c', position: 2, completedAt: null },
    ];
    const sorted = sortTasksWithCompleted(tasks);
    expect(sorted.map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('orders completed tasks by completedAt desc (most recent first)', () => {
    const tasks = [
      { id: 'x', position: 1, completedAt: '2024-01-01T00:00:00Z' },
      { id: 'y', position: 2, completedAt: '2024-06-01T00:00:00Z' },
    ];
    const sorted = sortTasksWithCompleted(tasks);
    expect(sorted.map((t) => t.id)).toEqual(['y', 'x']);
  });

  it('handles empty array', () => {
    expect(sortTasksWithCompleted([])).toEqual([]);
  });

  it('handles all completed', () => {
    const tasks = [
      { id: '1', position: 1, completedAt: '2024-01-01T00:00:00Z' },
      { id: '2', position: 2, completedAt: '2024-02-01T00:00:00Z' },
    ];
    const sorted = sortTasksWithCompleted(tasks);
    expect(sorted.map((t) => t.id)).toEqual(['2', '1']);
  });
});
