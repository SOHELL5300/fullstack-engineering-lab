import { randomUUID } from 'node:crypto';
import { HttpError, invalid } from './errors.js';

export const STATUSES = ['todo', 'in_progress', 'done'];
export const PRIORITIES = ['low', 'medium', 'high'];
const fields = ['title', 'description', 'status', 'priority'];

export function validateTask(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalid('Body must be a JSON object.');
  }
  if (Object.keys(input).some((key) => !fields.includes(key))) throw invalid('Unknown task field.');
  if (partial && Object.keys(input).length === 0) throw invalid('Patch must contain at least one field.');
  const result = {};
  if (!partial || 'title' in input) {
    if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 200) {
      throw invalid('Title must contain 1–200 characters after trimming.');
    }
    result.title = input.title.trim();
  }
  if ('description' in input) {
    if (typeof input.description !== 'string' || input.description.length > 2000) {
      throw invalid('Description must be a string of at most 2000 characters.');
    }
    result.description = input.description;
  }
  for (const [key, allowed] of [['status', STATUSES], ['priority', PRIORITIES]]) {
    if (key in input) {
      if (!allowed.includes(input[key])) throw invalid(`${key} must be one of: ${allowed.join(', ')}.`);
      result[key] = input[key];
    }
  }
  return result;
}

export function validateFilters(params) {
  const filters = {};
  for (const key of params.keys()) {
    if (!['status', 'priority', 'q'].includes(key) || params.getAll(key).length !== 1) {
      throw invalid('Only single status, priority, and q query parameters are supported.');
    }
    const value = params.get(key);
    if (key === 'status' && !STATUSES.includes(value)) throw invalid('Invalid status filter.');
    if (key === 'priority' && !PRIORITIES.includes(value)) throw invalid('Invalid priority filter.');
    if (key === 'q' && (value.trim().length === 0 || value.length > 200)) throw invalid('q must contain 1–200 characters.');
    filters[key] = key === 'q' ? value.trim().toLowerCase() : value;
  }
  return filters;
}

// A new store belongs to each app instance; no shared test or server state.
export function createTaskStore({ id = randomUUID, now = () => new Date().toISOString() } = {}) {
  const tasks = new Map();
  const get = (taskId) => {
    const task = tasks.get(taskId);
    if (!task) throw new HttpError(404, 'TASK_NOT_FOUND', 'Task not found.');
    return { ...task };
  };
  const list = (filters = {}) => [...tasks.values()].filter((task) =>
    (!filters.status || task.status === filters.status) &&
    (!filters.priority || task.priority === filters.priority) &&
    (!filters.q || `${task.title} ${task.description}`.toLowerCase().includes(filters.q))
  ).map((task) => ({ ...task }));
  return {
    get, list,
    create(input) {
      const values = validateTask(input);
      const timestamp = now();
      const task = { id: id(), description: '', status: 'todo', priority: 'medium', ...values, createdAt: timestamp, updatedAt: timestamp };
      tasks.set(task.id, task);
      return { ...task };
    },
    update(taskId, input) {
      const current = get(taskId);
      const task = { ...current, ...validateTask(input, true), updatedAt: now() };
      tasks.set(taskId, task);
      return { ...task };
    },
    delete(taskId) { get(taskId); tasks.delete(taskId); },
    statistics(filters = {}) {
      const selected = list(filters);
      return {
        total: selected.length,
        byStatus: Object.fromEntries(STATUSES.map((status) => [status, selected.filter((t) => t.status === status).length])),
        byPriority: Object.fromEntries(PRIORITIES.map((priority) => [priority, selected.filter((t) => t.priority === priority).length])),
      };
    },
  };
}
