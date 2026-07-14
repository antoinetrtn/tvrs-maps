import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskService } from "../services/TaskService";

describe("TaskService", () => {
  let taskService;

  beforeEach(() => {
    taskService = new TaskService();
  });

  describe("addTask", () => {
    it("should successfully add a valid task with default values", () => {
      const task = taskService.addTask({ title: "Test Task" });

      expect(task.id).toBeDefined();
      expect(typeof task.id).toBe("string");
      expect(task.title).toBe("Test Task");
      expect(task.description).toBe("");
      expect(task.status).toBe("pending");
      expect(task.priority).toBe("medium");
      expect(task.dueDate).toBeNull();
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(taskService.tasks).toHaveLength(1);
    });

    it("should add a task with custom properties", () => {
      const dueDate = new Date();
      const task = taskService.addTask({
        title: " Custom Title   ",
        description: "  Custom Description  ",
        status: "in_progress",
        priority: "high",
        dueDate: dueDate,
      });

      expect(task.title).toBe("Custom Title");
      expect(task.description).toBe("Custom Description");
      expect(task.status).toBe("in_progress");
      expect(task.priority).toBe("high");
      expect(task.dueDate).toEqual(dueDate);
    });

    it("should throw an error if taskData is null or not an object", () => {
      expect(() => taskService.addTask(null)).toThrow("Task data must be an object");
      expect(() => taskService.addTask("not an object")).toThrow("Task data must be an object");
    });

    it("should throw an error if title is missing, empty, or not a string", () => {
      expect(() => taskService.addTask({})).toThrow(
        "Title is required and must be a non-empty string"
      );
      expect(() => taskService.addTask({ title: "" })).toThrow(
        "Title is required and must be a non-empty string"
      );
      expect(() => taskService.addTask({ title: "   " })).toThrow(
        "Title is required and must be a non-empty string"
      );
      expect(() => taskService.addTask({ title: 123 })).toThrow(
        "Title is required and must be a non-empty string"
      );
    });

    it("should throw an error for invalid status values", () => {
      expect(() => taskService.addTask({ title: "Task", status: "invalid" })).toThrow(
        "Invalid status. Must be one of: pending, in_progress, completed"
      );
    });

    it("should throw an error for invalid priority values", () => {
      expect(() => taskService.addTask({ title: "Task", priority: "critical" })).toThrow(
        "Invalid priority. Must be one of: low, medium, high"
      );
    });

    it("should throw an error for invalid dueDate values", () => {
      expect(() => taskService.addTask({ title: "Task", dueDate: "invalid-date" })).toThrow(
        "Invalid dueDate. Must be a valid Date object or ISO string"
      );
    });
  });

  describe("getTask", () => {
    it("should retrieve a task by ID", () => {
      const added = taskService.addTask({ title: "Find me" });
      const retrieved = taskService.getTask(added.id);
      expect(retrieved).toEqual(added);
    });

    it("should throw an error if the task is not found", () => {
      expect(() => taskService.getTask("non-existent-id")).toThrow(
        "Task with ID non-existent-id not found"
      );
    });
  });

  describe("getTasks (with filtering)", () => {
    beforeEach(() => {
      taskService.addTask({
        title: "Task A",
        status: "pending",
        priority: "low",
        description: "First task",
      });
      taskService.addTask({
        title: "Task B",
        status: "in_progress",
        priority: "medium",
        description: "Second task",
      });
      taskService.addTask({
        title: "Task C",
        status: "completed",
        priority: "high",
        description: "Third task",
      });
    });

    it("should return all tasks when no filters are specified", () => {
      const results = taskService.getTasks();
      expect(results).toHaveLength(3);
    });

    it("should filter by status", () => {
      const results = taskService.getTasks({ status: "in_progress" });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Task B");
    });

    it("should filter by priority", () => {
      const results = taskService.getTasks({ priority: "high" });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Task C");
    });

    it("should filter by case-insensitive search in title or description", () => {
      const resultsTitle = taskService.getTasks({ search: "task A" });
      expect(resultsTitle).toHaveLength(1);
      expect(resultsTitle[0].title).toBe("Task A");

      const resultsDesc = taskService.getTasks({ search: "second" });
      expect(resultsDesc).toHaveLength(1);
      expect(resultsDesc[0].title).toBe("Task B");
    });

    it("should filter by dueBefore and dueAfter", () => {
      taskService.clearAll();
      const date1 = new Date("2026-07-01");
      const date2 = new Date("2026-07-10");
      const date3 = new Date("2026-07-20");

      taskService.addTask({ title: "Task 1", dueDate: date1 });
      taskService.addTask({ title: "Task 2", dueDate: date2 });
      taskService.addTask({ title: "Task 3", dueDate: date3 });

      const resultsBefore = taskService.getTasks({ dueBefore: "2026-07-15" });
      expect(resultsBefore).toHaveLength(2);
      expect(resultsBefore.map((t) => t.title)).toContain("Task 1");
      expect(resultsBefore.map((t) => t.title)).toContain("Task 2");

      const resultsAfter = taskService.getTasks({ dueAfter: "2026-07-05" });
      expect(resultsAfter).toHaveLength(2);
      expect(resultsAfter.map((t) => t.title)).toContain("Task 2");
      expect(resultsAfter.map((t) => t.title)).toContain("Task 3");

      const resultsBetween = taskService.getTasks({
        dueAfter: "2026-07-05",
        dueBefore: "2026-07-15",
      });
      expect(resultsBetween).toHaveLength(1);
      expect(resultsBetween[0].title).toBe("Task 2");
    });
  });

  describe("updateTask", () => {
    it("should successfully update task properties and update updatedAt timestamp", () => {
      const task = taskService.addTask({ title: "Initial Title", description: "Initial Desc" });
      const initialUpdatedAt = task.updatedAt;

      // Mock timers to ensure updatedAt changes
      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      const updated = taskService.updateTask(task.id, {
        title: "Updated Title",
        description: "Updated Desc",
        status: "completed",
        priority: "high",
        dueDate: "2026-12-31",
      });

      expect(updated.title).toBe("Updated Title");
      expect(updated.description).toBe("Updated Desc");
      expect(updated.status).toBe("completed");
      expect(updated.priority).toBe("high");
      expect(updated.dueDate).toEqual(new Date("2026-12-31"));
      expect(updated.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime());

      vi.useRealTimers();
    });

    it("should throw an error when updating a non-existent task", () => {
      expect(() => taskService.updateTask("invalid-id", { title: "New" })).toThrow(
        "Task with ID invalid-id not found"
      );
    });

    it("should validate updated values correctly", () => {
      const task = taskService.addTask({ title: "Task" });
      expect(() => taskService.updateTask(task.id, { title: "" })).toThrow(
        "Title must be a non-empty string"
      );
      expect(() => taskService.updateTask(task.id, { status: "invalid" })).toThrow(
        "Invalid status"
      );
    });
  });

  describe("deleteTask", () => {
    it("should successfully delete a task by ID", () => {
      const task = taskService.addTask({ title: "To Delete" });
      expect(taskService.tasks).toHaveLength(1);

      const deleted = taskService.deleteTask(task.id);
      expect(deleted.id).toBe(task.id);
      expect(taskService.tasks).toHaveLength(0);
    });

    it("should throw an error when deleting a non-existent task", () => {
      expect(() => taskService.deleteTask("invalid-id")).toThrow(
        "Task with ID invalid-id not found"
      );
    });
  });

  describe("getOverdueTasks", () => {
    it("should return tasks that are past their due date and not completed", () => {
      const pastDate = new Date(Date.now() - 100000);
      const futureDate = new Date(Date.now() + 100000);

      taskService.addTask({ title: "Overdue Pending", dueDate: pastDate, status: "pending" });
      taskService.addTask({
        title: "Overdue In Progress",
        dueDate: pastDate,
        status: "in_progress",
      });
      taskService.addTask({ title: "Completed Past Due", dueDate: pastDate, status: "completed" });
      taskService.addTask({ title: "Future Pending", dueDate: futureDate, status: "pending" });
      taskService.addTask({ title: "No Due Date", status: "pending" });

      const overdue = taskService.getOverdueTasks();
      expect(overdue).toHaveLength(2);
      expect(overdue.map((t) => t.title)).toContain("Overdue Pending");
      expect(overdue.map((t) => t.title)).toContain("Overdue In Progress");
    });
  });

  describe("getTasksSummary", () => {
    it("should return correct statistics for an empty task list", () => {
      const summary = taskService.getTasksSummary();
      expect(summary).toEqual({
        total: 0,
        completed: 0,
        pending: 0,
        inProgress: 0,
        completionRate: 0,
        byPriority: { low: 0, medium: 0, high: 0 },
      });
    });

    it("should return correct statistics for a non-empty task list", () => {
      taskService.addTask({ title: "T1", status: "completed", priority: "low" });
      taskService.addTask({ title: "T2", status: "completed", priority: "medium" });
      taskService.addTask({ title: "T3", status: "in_progress", priority: "medium" });
      taskService.addTask({ title: "T4", status: "pending", priority: "high" });

      const summary = taskService.getTasksSummary();
      expect(summary).toEqual({
        total: 4,
        completed: 2,
        pending: 1,
        inProgress: 1,
        completionRate: 50.0,
        byPriority: { low: 1, medium: 2, high: 1 },
      });
    });
  });

  describe("clearAll", () => {
    it("should remove all tasks", () => {
      taskService.addTask({ title: "T1" });
      taskService.addTask({ title: "T2" });
      expect(taskService.tasks).toHaveLength(2);

      taskService.clearAll();
      expect(taskService.tasks).toHaveLength(0);
    });
  });
});
