import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getGraphClient } from "../graph/client.js";
import { toolResult, toolError } from "../utils/errors.js";
import {
  listTaskLists,
  createTaskList,
  renameTaskList,
  deleteTaskList,
  listTasks,
  getTask,
  createTask,
  updateTask,
  setTaskStatus,
  deleteTask,
  moveTask,
  listChecklistItems,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from "../graph/todo.js";

const accountIdField = z
  .string()
  .optional()
  .describe("Account to use. Defaults to the default account.");

const listIdField = z.string().describe("Task list ID (from list_task_lists).");
const taskIdField = z.string().describe("Task ID (from list_tasks or create_task).");

const recurrenceSchema = z
  .object({
    pattern: z.object({
      type: z.enum([
        "daily",
        "weekly",
        "absoluteMonthly",
        "relativeMonthly",
        "absoluteYearly",
        "relativeYearly",
      ]),
      interval: z.number().int().min(1),
      daysOfWeek: z.array(z.string()).optional(),
      dayOfMonth: z.number().int().optional(),
      month: z.number().int().optional(),
    }),
    range: z.object({
      type: z.enum(["endDate", "noEnd", "numbered"]),
      startDate: z.string().describe("YYYY-MM-DD"),
      endDate: z.string().optional(),
      numberOfOccurrences: z.number().int().optional(),
    }),
  })
  .optional()
  .describe("Recurrence rule. Note: dueDateTime is required when setting recurrence.");

export function registerTodoTools(server: McpServer): void {
  // ══════════════════════════════════════════════════════════
  // TASK LISTS
  // ══════════════════════════════════════════════════════════

  // ── list_task_lists ────────────────────────────────────────────────────────
  server.tool(
    "list_task_lists",
    "Lists all To-Do task lists (personal lists, system lists like 'Tasks' and 'Flagged Email').",
    { accountId: accountIdField },
    async ({ accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const lists = await listTaskLists(client);
        return toolResult({ lists, total: lists.length });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── create_task_list ───────────────────────────────────────────────────────
  server.tool(
    "create_task_list",
    "Creates a new To-Do task list.",
    {
      displayName: z.string().describe("Name of the new list."),
      accountId: accountIdField,
    },
    async ({ displayName, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const list = await createTaskList(client, { displayName });
        return toolResult({ id: list.id, displayName: list.displayName });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── rename_task_list ───────────────────────────────────────────────────────
  server.tool(
    "rename_task_list",
    "Renames an existing To-Do task list.",
    {
      listId: listIdField,
      displayName: z.string().describe("New list name."),
      accountId: accountIdField,
    },
    async ({ listId, displayName, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const list = await renameTaskList(client, { listId, displayName });
        return toolResult({ id: list.id, displayName: list.displayName });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── delete_task_list ───────────────────────────────────────────────────────
  server.tool(
    "delete_task_list",
    "Deletes a To-Do task list and all tasks in it. " +
      "System lists (e.g. 'Tasks', 'Flagged Email') cannot be deleted.",
    {
      listId: listIdField,
      accountId: accountIdField,
    },
    async ({ listId, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        await deleteTaskList(client, { listId });
        return toolResult({ deleted: true });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ══════════════════════════════════════════════════════════
  // TASKS
  // ══════════════════════════════════════════════════════════

  // ── list_tasks ─────────────────────────────────────────────────────────────
  server.tool(
    "list_tasks",
    "Lists tasks in a To-Do list. Filter by status: open (default), completed or all.",
    {
      listId: listIdField,
      status: z
        .enum(["all", "open", "completed"])
        .optional()
        .describe("Task status filter. Default: open (excludes completed tasks)."),
      top: z.number().int().min(1).max(200).optional().describe("Max results. Default: 50."),
      nextLink: z.string().optional().describe("Pagination cursor from a previous response."),
      accountId: accountIdField,
    },
    async ({ listId, status, top, nextLink, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const result = await listTasks(client, { listId, status, top, nextLink });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── get_task ───────────────────────────────────────────────────────────────
  server.tool(
    "get_task",
    "Gets a task with full details: notes, recurrence and subtasks (checklist items).",
    {
      listId: listIdField,
      taskId: taskIdField,
      includeSubtasks: z
        .boolean()
        .optional()
        .describe("Include checklist items (subtasks). Default: true."),
      accountId: accountIdField,
    },
    async ({ listId, taskId, includeSubtasks, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const result = await getTask(client, {
          listId,
          taskId,
          includeSubtasks: includeSubtasks ?? true,
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── create_task ────────────────────────────────────────────────────────────
  server.tool(
    "create_task",
    "Creates a new task in a To-Do list.",
    {
      listId: listIdField,
      title: z.string().describe("Task title."),
      dueDateTime: z
        .string()
        .optional()
        .describe("Due date/time (ISO 8601). Required when setting recurrence."),
      reminderDateTime: z
        .string()
        .optional()
        .describe("Reminder date/time (ISO 8601). Enables the reminder automatically."),
      importance: z
        .enum(["low", "normal", "high"])
        .optional()
        .describe("Task importance. Default: normal."),
      body: z.string().optional().describe("Task notes/description."),
      categories: z.array(z.string()).optional().describe("Outlook category names."),
      recurrence: recurrenceSchema,
      accountId: accountIdField,
    },
    async ({
      listId,
      title,
      dueDateTime,
      reminderDateTime,
      importance,
      body,
      categories,
      recurrence,
      accountId,
    }) => {
      try {
        const client = getGraphClient(accountId);
        const task = await createTask(client, {
          listId,
          title,
          dueDateTime,
          reminderDateTime,
          importance,
          body,
          categories,
          recurrence,
        });
        return toolResult({ id: task.id, title: task.title, status: task.status });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── update_task ────────────────────────────────────────────────────────────
  server.tool(
    "update_task",
    "Updates one or more fields of an existing task. Only provided fields are changed.",
    {
      listId: listIdField,
      taskId: taskIdField,
      title: z.string().optional(),
      dueDateTime: z
        .string()
        .optional()
        .describe("New due date (ISO 8601). Pass empty string to remove."),
      reminderDateTime: z
        .string()
        .optional()
        .describe("New reminder (ISO 8601). Pass empty string to remove."),
      importance: z.enum(["low", "normal", "high"]).optional(),
      body: z.string().optional().describe("New notes."),
      categories: z.array(z.string()).optional(),
      recurrence: recurrenceSchema,
      accountId: accountIdField,
    },
    async ({
      listId,
      taskId,
      title,
      dueDateTime,
      reminderDateTime,
      importance,
      body,
      categories,
      recurrence,
      accountId,
    }) => {
      try {
        const client = getGraphClient(accountId);
        const task = await updateTask(client, {
          listId,
          taskId,
          title,
          dueDateTime,
          reminderDateTime,
          importance,
          body,
          categories,
          recurrence,
        });
        return toolResult({ id: task.id, title: task.title, status: task.status });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── complete_task ──────────────────────────────────────────────────────────
  server.tool(
    "complete_task",
    "Marks a task as completed or reopens it.",
    {
      listId: listIdField,
      taskId: taskIdField,
      completed: z
        .boolean()
        .optional()
        .describe("true = mark completed, false = reopen. Default: true."),
      accountId: accountIdField,
    },
    async ({ listId, taskId, completed, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const task = await setTaskStatus(client, {
          listId,
          taskId,
          completed: completed ?? true,
        });
        return toolResult({ id: task.id, status: task.status });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── delete_task ────────────────────────────────────────────────────────────
  server.tool(
    "delete_task",
    "Permanently deletes a task and all its subtasks.",
    {
      listId: listIdField,
      taskId: taskIdField,
      accountId: accountIdField,
    },
    async ({ listId, taskId, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        await deleteTask(client, { listId, taskId });
        return toolResult({ deleted: true });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── move_task ──────────────────────────────────────────────────────────────
  server.tool(
    "move_task",
    "Moves a task from one list to another, preserving all fields and subtasks. " +
      "Implemented as copy + delete (Graph has no native move). " +
      "If deletion of the original fails, a warning is returned with both task IDs.",
    {
      sourceListId: z.string().describe("List ID the task currently belongs to."),
      taskId: taskIdField,
      destinationListId: z.string().describe("List ID to move the task to."),
      accountId: accountIdField,
    },
    async ({ sourceListId, taskId, destinationListId, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const result = await moveTask(client, {
          sourceListId,
          taskId,
          destinationListId,
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ══════════════════════════════════════════════════════════
  // SUBTASKS (CHECKLIST ITEMS)
  // ══════════════════════════════════════════════════════════

  // ── list_subtasks ──────────────────────────────────────────────────────────
  server.tool(
    "list_subtasks",
    "Lists all subtasks (checklist items) of a task.",
    {
      listId: listIdField,
      taskId: taskIdField,
      accountId: accountIdField,
    },
    async ({ listId, taskId, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const subtasks = await listChecklistItems(client, { listId, taskId });
        return toolResult({ subtasks, total: subtasks.length });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── add_subtask ────────────────────────────────────────────────────────────
  server.tool(
    "add_subtask",
    "Adds a subtask (checklist item) to a task.",
    {
      listId: listIdField,
      taskId: taskIdField,
      displayName: z.string().describe("Subtask text."),
      isChecked: z
        .boolean()
        .optional()
        .describe("Mark as already done. Default: false."),
      accountId: accountIdField,
    },
    async ({ listId, taskId, displayName, isChecked, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const item = await addChecklistItem(client, {
          listId,
          taskId,
          displayName,
          isChecked,
        });
        return toolResult(item);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── update_subtask ─────────────────────────────────────────────────────────
  server.tool(
    "update_subtask",
    "Updates a subtask's text or checked state.",
    {
      listId: listIdField,
      taskId: taskIdField,
      checklistItemId: z.string().describe("Subtask ID (from list_subtasks)."),
      displayName: z.string().optional().describe("New subtask text."),
      isChecked: z
        .boolean()
        .optional()
        .describe("true = check off, false = uncheck."),
      accountId: accountIdField,
    },
    async ({ listId, taskId, checklistItemId, displayName, isChecked, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const item = await updateChecklistItem(client, {
          listId,
          taskId,
          checklistItemId,
          displayName,
          isChecked,
        });
        return toolResult(item);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── delete_subtask ─────────────────────────────────────────────────────────
  server.tool(
    "delete_subtask",
    "Deletes a subtask (checklist item) from a task.",
    {
      listId: listIdField,
      taskId: taskIdField,
      checklistItemId: z.string().describe("Subtask ID (from list_subtasks)."),
      accountId: accountIdField,
    },
    async ({ listId, taskId, checklistItemId, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        await deleteChecklistItem(client, { listId, taskId, checklistItemId });
        return toolResult({ deleted: true });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
