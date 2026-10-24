import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runInIdleSlices } from "../globe/render/idleQueue";

describe("runInIdleSlices", () => {
  let originalRequestIdleCallback;
  let originalCancelIdleCallback;

  beforeEach(() => {
    vi.useFakeTimers();
    originalRequestIdleCallback = window.requestIdleCallback;
    originalCancelIdleCallback = window.cancelIdleCallback;
    delete window.requestIdleCallback;
    delete window.cancelIdleCallback;
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalRequestIdleCallback !== undefined) {
      window.requestIdleCallback = originalRequestIdleCallback;
    }
    if (originalCancelIdleCallback !== undefined) {
      window.cancelIdleCallback = originalCancelIdleCallback;
    }
  });

  it("runs all tasks in order and calls onDone once after the last task", () => {
    const executed = [];
    const tasks = [
      vi.fn(() => executed.push("task 1")),
      vi.fn(() => executed.push("task 2")),
      vi.fn(() => executed.push("task 3")),
    ];
    const onDone = vi.fn(() => executed.push("done"));

    runInIdleSlices(tasks, { onDone });

    expect(executed).toEqual([]);
    expect(onDone).not.toHaveBeenCalled();

    vi.runAllTimers();

    tasks.forEach((task) => expect(task).toHaveBeenCalledTimes(1));
    expect(executed).toEqual(["task 1", "task 2", "task 3", "done"]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("defers execution of the first task until startDelayMs has elapsed", () => {
    const task1 = vi.fn();
    const task2 = vi.fn();
    const onDone = vi.fn();

    runInIdleSlices([task1, task2], { startDelayMs: 150, onDone });

    vi.advanceTimersByTime(149);
    expect(task1).not.toHaveBeenCalled();
    expect(task2).not.toHaveBeenCalled();

    // At startDelayMs, startTimer fires and schedules step with setTimeout(..., 16)
    vi.advanceTimersByTime(1);
    expect(task1).not.toHaveBeenCalled();

    // Advance 16ms to fire the scheduled step
    vi.advanceTimersByTime(16);
    expect(task1).toHaveBeenCalledTimes(1);
    expect(task2).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("stops further tasks and prevents onDone when cancel is called", () => {
    const task1 = vi.fn();
    const task2 = vi.fn();
    const onDone = vi.fn();

    const cancel = runInIdleSlices([task1, task2], { startDelayMs: 100, onDone });

    vi.advanceTimersByTime(50);
    cancel();

    vi.runAllTimers();

    expect(task1).not.toHaveBeenCalled();
    expect(task2).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("stops tasks across slices when cancel is called before next slice", () => {
    const executed = [];
    let fakeTime = 0;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => fakeTime);

    const tasks = [
      vi.fn(() => {
        executed.push("t1");
        fakeTime += 10; // Exceeds budgetMs (6), breaking current slice
      }),
      vi.fn(() => executed.push("t2")),
    ];
    const onDone = vi.fn(() => executed.push("done"));

    const cancel = runInIdleSlices(tasks, { budgetMs: 6, onDone });

    // Step scheduled after 0ms startDelay + 16ms fallback delay
    vi.advanceTimersByTime(16);
    expect(executed).toEqual(["t1"]);
    expect(tasks[0]).toHaveBeenCalledTimes(1);
    expect(tasks[1]).not.toHaveBeenCalled();

    cancel();
    vi.runAllTimers();

    expect(executed).toEqual(["t1"]);
    expect(tasks[1]).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });
});
