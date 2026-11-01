const VALID_STATUSES = ["pending", "in_progress", "completed"];
const VALID_PRIORITIES = ["low", "medium", "high"];

function isValidTitle(title) {
  return typeof title === "string" && title.trim() !== "";
}

function validateTitle(data, isUpdate) {
  if (isUpdate) {
    if ("title" in data && !isValidTitle(data.title)) {
      throw new Error("Title must be a non-empty string");
    }
    return;
  }
  if (!isValidTitle(data.title)) {
    throw new Error("Title is required and must be a non-empty string");
  }
}

function validateStatus(status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`);
  }
}

function validatePriority(priority) {
  if (!VALID_PRIORITIES.includes(priority)) {
    throw new Error(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}`);
  }
}

function validateDueDate(dueDate) {
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Invalid dueDate. Must be a valid Date object or ISO string");
  }
}

/**
 * TaskService manages a collection of tasks with validation, filtering, and summary statistics.
 */
export class TaskService {
  constructor() {
    this.tasks = [];
  }

  /**
   * Helper to generate a unique ID.
   */
  _generateId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    const rand = globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
    return `task-${rand.toString(36).slice(2, 11)}-${Date.now()}`;
  }

  /**
   * Validates task input fields.
   */
  _validateTaskData(data, isUpdate = false) {
    if (data === null || typeof data !== "object") {
      throw new Error("Task data must be an object");
    }

    validateTitle(data, isUpdate);

    if ("status" in data) {
      validateStatus(data.status);
    }

    if ("priority" in data) {
      validatePriority(data.priority);
    }

    if ("dueDate" in data && data.dueDate !== null) {
      validateDueDate(data.dueDate);
    }
  }

  /**
   * Adds a new task.
   * @param {Object} taskData - The task details.
   * @returns {Object} The created task.
   */
  addTask(taskData) {
    this._validateTaskData(taskData, false);

    const now = new Date();
    const newTask = {
      id: this._generateId(),
      title: taskData.title.trim(),
      description: taskData.description ? String(taskData.description).trim() : "",
      status: taskData.status || "pending",
      priority: taskData.priority || "medium",
      dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.push(newTask);
    return newTask;
  }

  /**
   * Retrieves a task by its ID.
   * @param {string} id - The task ID.
   * @returns {Object} The task.
   */
  getTask(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) {
      throw new Error(`Task with ID ${id} not found`);
    }
    return task;
  }

  /**
   * Retrieves all tasks matching the specified filters.
   * @param {Object} filters - Filter criteria.
   * @returns {Array} List of matching tasks.
   */
  getTasks(filters = {}) {
    return this.tasks.filter((task) => {
      if (filters.status && task.status !== filters.status) {
        return false;
      }
      if (filters.priority && task.priority !== filters.priority) {
        return false;
      }
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const titleMatch = task.title.toLowerCase().includes(query);
        const descMatch = task.description.toLowerCase().includes(query);
        if (!titleMatch && !descMatch) {
          return false;
        }
      }
      if (filters.dueBefore) {
        if (!task.dueDate || task.dueDate > new Date(filters.dueBefore)) {
          return false;
        }
      }
      if (filters.dueAfter) {
        if (!task.dueDate || task.dueDate < new Date(filters.dueAfter)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Updates an existing task by ID.
   * @param {string} id - The task ID.
   * @param {Object} updates - Fields to update.
   * @returns {Object} The updated task.
   */
  updateTask(id, updates) {
    const task = this.getTask(id);
    this._validateTaskData(updates, true);

    const now = new Date();
    const updatableFields = ["title", "description", "status", "priority", "dueDate"];

    updatableFields.forEach((field) => {
      if (field in updates) {
        if (field === "title") {
          task.title = updates.title.trim();
        } else if (field === "description") {
          task.description = updates.description ? String(updates.description).trim() : "";
        } else if (field === "dueDate") {
          task.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
        } else {
          task.status = updates.status || task.status;
          task.priority = updates.priority || task.priority;
        }
      }
    });

    task.updatedAt = now;
    return task;
  }

  /**
   * Deletes a task by ID.
   * @param {string} id - The task ID.
   * @returns {Object} The deleted task.
   */
  deleteTask(id) {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Task with ID ${id} not found`);
    }
    const [deletedTask] = this.tasks.splice(index, 1);
    return deletedTask;
  }

  /**
   * Clears all tasks.
   */
  clearAll() {
    this.tasks = [];
  }

  /**
   * Retrieves overdue tasks (dueDate in the past and status is not completed).
   * @returns {Array} List of overdue tasks.
   */
  getOverdueTasks() {
    const now = new Date();
    return this.tasks.filter((task) => {
      return task.status !== "completed" && task.dueDate && task.dueDate < now;
    });
  }

  /**
   * Returns a statistical summary of all tasks.
   * @returns {Object} Statistical summary.
   */
  getTasksSummary() {
    const total = this.tasks.length;
    if (total === 0) {
      return {
        total: 0,
        completed: 0,
        pending: 0,
        inProgress: 0,
        completionRate: 0,
        byPriority: { low: 0, medium: 0, high: 0 },
      };
    }

    let completed = 0;
    let pending = 0;
    let inProgress = 0;
    const byPriority = { low: 0, medium: 0, high: 0 };

    this.tasks.forEach((task) => {
      if (task.status === "completed") completed++;
      else if (task.status === "in_progress") inProgress++;
      else pending++;

      if (task.priority in byPriority) {
        byPriority[task.priority]++;
      }
    });

    const completionRate = Number.parseFloat(((completed / total) * 100).toFixed(2));

    return {
      total,
      completed,
      pending,
      inProgress,
      completionRate,
      byPriority,
    };
  }
}
