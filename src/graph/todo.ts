import type { Client } from "@microsoft/microsoft-graph-client";
import type {
  TodoTaskList,
  TodoTask,
  ChecklistItem,
} from "@microsoft/microsoft-graph-types";

// ── Field selectors ──────────────────────────────────────────────────────────

const LIST_FIELDS = "id,displayName,wellknownListName,isOwner,isShared";

const TASK_SUMMARY_FIELDS =
  "id,title,status,importance,dueDateTime,reminderDateTime," +
  "isReminderOn,categories,hasChecklistItems,createdDateTime,lastModifiedDateTime";

const TASK_FULL_FIELDS =
  "id,title,status,importance,dueDateTime,reminderDateTime," +
  "isReminderOn,categories,body,recurrence,hasChecklistItems,createdDateTime,lastModifiedDateTime";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  title: string;
  dueDateTime?: string;
  reminderDateTime?: string;
  importance?: "low" | "normal" | "high";
  body?: string;
  categories?: string[];
  recurrence?: unknown;
}

export interface UpdateTaskInput {
  title?: string;
  dueDateTime?: string;
  reminderDateTime?: string;
  importance?: "low" | "normal" | "high";
  body?: string;
  categories?: string[];
  recurrence?: unknown;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateTimeZone(isoDate: string, timeZone = "UTC") {
  return { dateTime: isoDate, timeZone };
}

function buildTaskPatch(input: UpdateTaskInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.dueDateTime !== undefined)
    patch.dueDateTime = input.dueDateTime ? toDateTimeZone(input.dueDateTime) : null;
  if (input.reminderDateTime !== undefined) {
    patch.reminderDateTime = input.reminderDateTime
      ? toDateTimeZone(input.reminderDateTime)
      : null;
    patch.isReminderOn = !!input.reminderDateTime;
  }
  if (input.importance !== undefined) patch.importance = input.importance;
  if (input.body !== undefined) patch.body = { contentType: "Text", content: input.body };
  if (input.categories !== undefined) patch.categories = input.categories;
  if (input.recurrence !== undefined) patch.recurrence = input.recurrence;
  return patch;
}

// ── Task lists ────────────────────────────────────────────────────────────────

export async function listTaskLists(
  client: Client
): Promise<Partial<TodoTaskList>[]> {
  const response = (await client
    .api("/me/todo/lists")
    .select(LIST_FIELDS)
    .top(100)
    .get()) as { value: Partial<TodoTaskList>[] };
  return response.value ?? [];
}

export async function createTaskList(
  client: Client,
  params: { displayName: string }
): Promise<Partial<TodoTaskList>> {
  return client
    .api("/me/todo/lists")
    .post({ displayName: params.displayName }) as Promise<Partial<TodoTaskList>>;
}

export async function renameTaskList(
  client: Client,
  params: { listId: string; displayName: string }
): Promise<Partial<TodoTaskList>> {
  return client
    .api(`/me/todo/lists/${params.listId}`)
    .patch({ displayName: params.displayName }) as Promise<Partial<TodoTaskList>>;
}

export async function deleteTaskList(
  client: Client,
  params: { listId: string }
): Promise<void> {
  await client.api(`/me/todo/lists/${params.listId}`).delete();
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function listTasks(
  client: Client,
  params: {
    listId: string;
    status?: "all" | "open" | "completed";
    top?: number;
    nextLink?: string;
  }
): Promise<{ items: Partial<TodoTask>[]; nextLink?: string }> {
  let response: { value: Partial<TodoTask>[]; "@odata.nextLink"?: string };

  if (params.nextLink) {
    response = (await client.api(params.nextLink).get()) as typeof response;
  } else {
    let api = client
      .api(`/me/todo/lists/${params.listId}/tasks`)
      .select(TASK_SUMMARY_FIELDS)
      .top(params.top ?? 50);

    const statusFilter = params.status ?? "open";
    if (statusFilter === "open") {
      api = api.filter("status ne 'completed'");
    } else if (statusFilter === "completed") {
      api = api.filter("status eq 'completed'");
    }

    response = (await api.get()) as typeof response;
  }

  return {
    items: response.value ?? [],
    nextLink: response["@odata.nextLink"],
  };
}

export async function getTask(
  client: Client,
  params: { listId: string; taskId: string; includeSubtasks?: boolean }
): Promise<{ task: Partial<TodoTask>; subtasks?: Partial<ChecklistItem>[] }> {
  const task = (await client
    .api(`/me/todo/lists/${params.listId}/tasks/${params.taskId}`)
    .select(TASK_FULL_FIELDS)
    .get()) as Partial<TodoTask>;

  let subtasks: Partial<ChecklistItem>[] | undefined;
  if (params.includeSubtasks) {
    subtasks = await listChecklistItems(client, {
      listId: params.listId,
      taskId: params.taskId,
    });
  }

  return { task, subtasks };
}

export async function createTask(
  client: Client,
  params: { listId: string } & CreateTaskInput
): Promise<Partial<TodoTask>> {
  const { listId, ...input } = params;
  const body: Record<string, unknown> = { title: input.title };

  if (input.dueDateTime) body.dueDateTime = toDateTimeZone(input.dueDateTime);
  if (input.reminderDateTime) {
    body.reminderDateTime = toDateTimeZone(input.reminderDateTime);
    body.isReminderOn = true;
  }
  if (input.importance) body.importance = input.importance;
  if (input.body) body.body = { contentType: "Text", content: input.body };
  if (input.categories?.length) body.categories = input.categories;
  if (input.recurrence) body.recurrence = input.recurrence;

  return client
    .api(`/me/todo/lists/${listId}/tasks`)
    .post(body) as Promise<Partial<TodoTask>>;
}

export async function updateTask(
  client: Client,
  params: { listId: string; taskId: string } & UpdateTaskInput
): Promise<Partial<TodoTask>> {
  const { listId, taskId, ...rest } = params;
  return client
    .api(`/me/todo/lists/${listId}/tasks/${taskId}`)
    .patch(buildTaskPatch(rest)) as Promise<Partial<TodoTask>>;
}

export async function setTaskStatus(
  client: Client,
  params: { listId: string; taskId: string; completed: boolean }
): Promise<Partial<TodoTask>> {
  return client
    .api(`/me/todo/lists/${params.listId}/tasks/${params.taskId}`)
    .patch({ status: params.completed ? "completed" : "notStarted" }) as Promise<Partial<TodoTask>>;
}

export async function deleteTask(
  client: Client,
  params: { listId: string; taskId: string }
): Promise<void> {
  await client.api(`/me/todo/lists/${params.listId}/tasks/${params.taskId}`).delete();
}

export async function moveTask(
  client: Client,
  params: { sourceListId: string; taskId: string; destinationListId: string }
): Promise<{ movedTaskId: string; warning?: string }> {
  // 1. Read source task + subtasks
  const { task, subtasks } = await getTask(client, {
    listId: params.sourceListId,
    taskId: params.taskId,
    includeSubtasks: true,
  });

  // 2. Create copy in destination list
  const newTask = await createTask(client, {
    listId: params.destinationListId,
    title: (task.title as string) ?? "Untitled",
    dueDateTime: (task.dueDateTime as { dateTime: string } | undefined)?.dateTime,
    reminderDateTime: (task.reminderDateTime as { dateTime: string } | undefined)?.dateTime,
    importance: task.importance as "low" | "normal" | "high" | undefined,
    body: (task.body as { content: string } | undefined)?.content,
    categories: task.categories as string[] | undefined,
    recurrence: task.recurrence,
  });

  const newTaskId = newTask.id as string;

  // 3. Re-create subtasks on the new task
  if (subtasks?.length) {
    for (const sub of subtasks) {
      await addChecklistItem(client, {
        listId: params.destinationListId,
        taskId: newTaskId,
        displayName: (sub.displayName as string) ?? "",
        isChecked: (sub.isChecked as boolean) ?? false,
      });
    }
  }

  // 4. Delete the original — if this fails, return a warning instead of throwing
  let warning: string | undefined;
  try {
    await deleteTask(client, {
      listId: params.sourceListId,
      taskId: params.taskId,
    });
  } catch {
    warning =
      `MOVE_PARTIAL: Task was copied to '${params.destinationListId}' (id: ${newTaskId}) ` +
      `but the original in '${params.sourceListId}' could not be deleted. Please remove it manually.`;
  }

  return { movedTaskId: newTaskId, ...(warning && { warning }) };
}

// ── Checklist items (subtasks) ────────────────────────────────────────────────

export async function listChecklistItems(
  client: Client,
  params: { listId: string; taskId: string }
): Promise<Partial<ChecklistItem>[]> {
  const response = (await client
    .api(
      `/me/todo/lists/${params.listId}/tasks/${params.taskId}/checklistItems`
    )
    .get()) as { value: Partial<ChecklistItem>[] };
  return response.value ?? [];
}

export async function addChecklistItem(
  client: Client,
  params: { listId: string; taskId: string; displayName: string; isChecked?: boolean }
): Promise<Partial<ChecklistItem>> {
  return client
    .api(
      `/me/todo/lists/${params.listId}/tasks/${params.taskId}/checklistItems`
    )
    .post({
      displayName: params.displayName,
      isChecked: params.isChecked ?? false,
    }) as Promise<Partial<ChecklistItem>>;
}

export async function updateChecklistItem(
  client: Client,
  params: {
    listId: string;
    taskId: string;
    checklistItemId: string;
    displayName?: string;
    isChecked?: boolean;
  }
): Promise<Partial<ChecklistItem>> {
  const patch: Record<string, unknown> = {};
  if (params.displayName !== undefined) patch.displayName = params.displayName;
  if (params.isChecked !== undefined) patch.isChecked = params.isChecked;

  return client
    .api(
      `/me/todo/lists/${params.listId}/tasks/${params.taskId}/checklistItems/${params.checklistItemId}`
    )
    .patch(patch) as Promise<Partial<ChecklistItem>>;
}

export async function deleteChecklistItem(
  client: Client,
  params: { listId: string; taskId: string; checklistItemId: string }
): Promise<void> {
  await client
    .api(
      `/me/todo/lists/${params.listId}/tasks/${params.taskId}/checklistItems/${params.checklistItemId}`
    )
    .delete();
}
