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
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'task-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
  }

  /**
   * Validates task input fields.
   */
  _validateTaskData(data, isUpdate = false) {
    if (data === null || typeof data !== 'object') {
      throw new Error("Task data must be an object");
    }

    // Title validation
    if (isUpdate) {
      if ('title' in data && (typeof data.title !== 'string' || data.title.trim() === '')) {
        throw new Error("Title must be a non-empty string");
      }
    } else {
      if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
        throw new Error("Title is required and must be a non-empty string");
      }
    }

    // Status validation
    const validStatuses = ['pending', 'in_progress', 'completed'];
    if ('status' in data && !validStatuses.includes(data.status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Priority validation
    const validPriorities = ['low', 'medium', 'high'];
    if ('priority' in data && !validPriorities.includes(data.priority)) {
      throw new Error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
    }

    // Due date validation
    if ('dueDate' in data && data.dueDate !== null) {
      const date = new Date(data.dueDate);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid dueDate. Must be a valid Date object or ISO string");
      }
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
      description: taskData.description ? String(taskData.description).trim() : '',
      status: taskData.status || 'pending',
      priority: taskData.priority || 'medium',
      dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
      createdAt: now,
      updatedAt: now
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
    const task = this.tasks.find(t => t.id === id);
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
    return this.tasks.filter(task => {
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
    const updatableFields = ['title', 'description', 'status', 'priority', 'dueDate'];

    updatableFields.forEach(field => {
      if (field in updates) {
        if (field === 'title') {
          task.title = updates.title.trim();
        } else if (field === 'description') {
          task.description = updates.description ? String(updates.description).trim() : '';
        } else if (field === 'dueDate') {
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
    const index = this.tasks.findIndex(t => t.id === id);
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
    return this.tasks.filter(task => {
      return task.status !== 'completed' && task.dueDate && task.dueDate < now;
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
        byPriority: { low: 0, medium: 0, high: 0 }
      };
    }

    let completed = 0;
    let pending = 0;
    let inProgress = 0;
    const byPriority = { low: 0, medium: 0, high: 0 };

    this.tasks.forEach(task => {
      if (task.status === 'completed') completed++;
      else if (task.status === 'in_progress') inProgress++;
      else pending++;

      if (task.priority in byPriority) {
        byPriority[task.priority]++;
      }
    });

    const completionRate = parseFloat(((completed / total) * 100).toFixed(2));

    return {
      total,
      completed,
      pending,
      inProgress,
      completionRate,
      byPriority
    };
  }
}
