# Referência de Tools

Referência completa das **63 tools** expostas pelo servidor MCP, agrupadas por módulo. Parâmetros marcados com `*` são obrigatórios. O parâmetro `accountId` é sempre opcional e, quando omitido, usa a conta padrão.

## Índice

- [Autenticação](#autenticacao) (6)
- [Email](#email) (17)
- [Calendário](#calendario) (8)
- [To-Do](#to-do) (15)
- [Contatos](#contatos) (6)
- [OneDrive](#onedrive) (11)

## Autenticação

| Tool | Descrição | Parâmetros |
|---|---|---|
| `add_account` | Starts a Device Code Flow to connect a new Microsoft account (personal or work). Returns a verification URL and short code to open in any browser. After authenticating, call confirm_account_auth with the returned userCode. | `tenant` |
| `confirm_account_auth` | Completes account authentication after the user has finished the Device Code Flow. Call this with the userCode returned by add_account, after the user has authenticated in the browser. | `userCode`* |
| `list_accounts` | Lists all connected Microsoft accounts. | — |
| `set_default_account` | Sets which connected account is used by default when no accountId is specified. | `accountId`* |
| `remove_account` | Removes a connected account and deletes its tokens from local cache. Does NOT revoke consent in Azure — visit https://myapps.microsoft.com for full revocation. | `accountId`* |
| `whoami` | Returns the Microsoft profile of the specified account (or default account), confirming authentication is working. | `accountId` |

## Email

| Tool | Descrição | Parâmetros |
|---|---|---|
| `list_emails` | Lists emails in a mailbox folder, ordered by newest first. Well-known folder IDs: inbox, archive, drafts, sentitems, deleteditems, junkemail. | `folderId`, `unreadOnly`, `top`, `nextLink`, `accountId` |
| `search_emails` | Full-text search across all emails using KQL syntax. Examples: 'project proposal', 'from:boss@company.com', 'subject:invoice', 'hasAttachments:true'. | `query`*, `top`, `nextLink`, `accountId` |
| `get_email` | Gets the full content of an email including body, all recipients and attachment list. Use download_attachment to retrieve attachment content. | `messageId`*, `includeAttachments`, `accountId` |
| `download_attachment` | Downloads the content of an email attachment. Returns name, MIME type and content as base64. Attachments larger than ~4 MB may fail — consider noting the attachment name/type instead. | `messageId`*, `attachmentId`*, `accountId` |
| `send_email` | Sends an email. Supports plain text and HTML body, CC, BCC and inline attachments (max ~4 MB each). | `to`*, `subject`*, `body`*, `bodyType`, `cc`, `bcc`, `attachments`, `saveToSentItems`, `accountId` |
| `create_draft` | Creates an email draft (does not send). Returns the draft ID for later use. | `to`*, `subject`*, `body`*, `bodyType`, `cc`, `bcc`, `attachments`, `accountId` |
| `reply_email` | Replies to an email. Use replyAll to include all original recipients. | `messageId`*, `body`*, `replyAll`, `accountId` |
| `forward_email` | Forwards an email to one or more recipients. | `messageId`*, `to`*, `comment`, `accountId` |
| `move_email` | Moves an email to a different folder. Well-known destinations: inbox, archive, drafts, sentitems, deleteditems, junkemail. | `messageId`*, `destinationFolderId`*, `accountId` |
| `archive_email` | Archives an email (moves it to the Archive folder). | `messageId`*, `accountId` |
| `delete_email` | Deletes an email. By default moves to Deleted Items. Set permanent=true to delete forever. | `messageId`*, `permanent`, `accountId` |
| `set_email_categories` | Applies Outlook categories (colour tags) to an email. Replaces all existing categories. Use list_categories to see available categories, or create_category to add new ones. | `messageId`*, `categories`*, `accountId` |
| `mark_email` | Marks an email as read/unread, flags it, or sets importance. | `messageId`*, `isRead`, `flag`, `importance`, `accountId` |
| `list_mail_folders` | Lists mail folders. Omit parentFolderId to list root folders; provide it to list subfolders. | `parentFolderId`, `accountId` |
| `create_mail_folder` | Creates a new mail folder. Provide parentFolderId to create a subfolder. | `displayName`*, `parentFolderId`, `accountId` |
| `list_categories` | Lists all Outlook colour categories available in the account (the master category palette). | `accountId` |
| `create_category` | Creates a new Outlook colour category. Color presets: preset0 (red) through preset24. Leave blank for no colour. | `displayName`*, `color`, `accountId` |

## Calendário

| Tool | Descrição | Parâmetros |
|---|---|---|
| `list_events` | Lists calendar events in a date/time range. Recurring events are expanded into individual occurrences. Order: chronological by start time. | `startDateTime`*, `endDateTime`*, `timeZone`, `calendarId`, `top`, `nextLink`, `accountId` |
| `get_event` | Gets the full details of a calendar event including body, all attendees and recurrence pattern. | `eventId`*, `timeZone`, `accountId` |
| `create_event` | Creates a new calendar event. Invite attendees by email — they will receive an invitation. Set isOnlineMeeting=true to auto-generate a Teams meeting link. | `subject`*, `start`*, `end`*, `timeZone`, `isAllDay`, `body`, `location`, `attendees`, `isOnlineMeeting`, `reminderMinutesBeforeStart`, `recurrence`, `calendarId`, `accountId` |
| `update_event` | Updates one or more fields of an existing calendar event. Only provided fields are changed. | `eventId`*, `subject`, `start`, `end`, `timeZone`, `isAllDay`, `body`, `location`, `attendees`, `isOnlineMeeting`, `reminderMinutesBeforeStart`, `recurrence`, `accountId` |
| `delete_event` | Deletes a calendar event. Attendees will receive a cancellation notice. | `eventId`*, `accountId` |
| `respond_to_event` | Responds to a meeting invitation: accept, decline or mark as tentative. Cannot be used on events you organise yourself. | `eventId`*, `response`*, `comment`, `sendResponse`, `accountId` |
| `list_calendars` | Lists all calendars in the account (personal, shared, subscribed). | `accountId` |
| `find_meeting_times` | Suggests available meeting time slots when all specified attendees are free. Returns a ranked list of suggestions with confidence scores. | `attendees`*, `durationMinutes`*, `timeWindowStart`*, `timeWindowEnd`*, `timeZone`, `accountId` |

## To-Do

| Tool | Descrição | Parâmetros |
|---|---|---|
| `list_task_lists` | Lists all To-Do task lists (personal lists, system lists like 'Tasks' and 'Flagged Email'). | `accountId` |
| `create_task_list` | Creates a new To-Do task list. | `displayName`*, `accountId` |
| `rename_task_list` | Renames an existing To-Do task list. | `listId`*, `displayName`*, `accountId` |
| `delete_task_list` | Deletes a To-Do task list and all tasks in it. System lists (e.g. 'Tasks', 'Flagged Email') cannot be deleted. | `listId`*, `accountId` |
| `list_tasks` | Lists tasks in a To-Do list. Filter by status: open (default), completed or all. | `listId`*, `status`, `top`, `nextLink`, `accountId` |
| `get_task` | Gets a task with full details: notes, recurrence and subtasks (checklist items). | `listId`*, `taskId`*, `includeSubtasks`, `accountId` |
| `create_task` | Creates a new task in a To-Do list. | `listId`*, `title`*, `dueDateTime`, `reminderDateTime`, `importance`, `body`, `categories`, `recurrence`, `accountId` |
| `update_task` | Updates one or more fields of an existing task. Only provided fields are changed. | `listId`*, `taskId`*, `title`, `dueDateTime`, `reminderDateTime`, `importance`, `body`, `categories`, `recurrence`, `accountId` |
| `complete_task` | Marks a task as completed or reopens it. | `listId`*, `taskId`*, `completed`, `accountId` |
| `delete_task` | Permanently deletes a task and all its subtasks. | `listId`*, `taskId`*, `accountId` |
| `move_task` | Moves a task from one list to another, preserving all fields and subtasks. Implemented as copy + delete (Graph has no native move). If deletion of the original fails, a warning is returned with both task IDs. | `sourceListId`*, `taskId`*, `destinationListId`*, `accountId` |
| `list_subtasks` | Lists all subtasks (checklist items) of a task. | `listId`*, `taskId`*, `accountId` |
| `add_subtask` | Adds a subtask (checklist item) to a task. | `listId`*, `taskId`*, `displayName`*, `isChecked`, `accountId` |
| `update_subtask` | Updates a subtask's text or checked state. | `listId`*, `taskId`*, `checklistItemId`*, `displayName`, `isChecked`, `accountId` |
| `delete_subtask` | Deletes a subtask (checklist item) from a task. | `listId`*, `taskId`*, `checklistItemId`*, `accountId` |

## Contatos

| Tool | Descrição | Parâmetros |
|---|---|---|
| `list_contacts` | Lists contacts in the account address book, ordered alphabetically by display name. | `top`, `nextLink`, `accountId` |
| `search_contacts` | Searches contacts by name, email address, company or any other field using full-text search. | `query`*, `top`, `nextLink`, `accountId` |
| `get_contact` | Gets full details of a contact including addresses, notes and all phone numbers. | `contactId`*, `accountId` |
| `create_contact` | Creates a new contact. At least one of givenName, surname or displayName is required. | `givenName`, `surname`, `displayName`, `emailAddresses`, `mobilePhone`, `businessPhones`, `companyName`, `jobTitle`, `department`, `officeLocation`, `notes`, `accountId` |
| `update_contact` | Updates one or more fields of an existing contact. Only provided fields are changed. | `contactId`*, `givenName`, `surname`, `displayName`, `emailAddresses`, `mobilePhone`, `businessPhones`, `companyName`, `jobTitle`, `department`, `officeLocation`, `notes`, `accountId` |
| `delete_contact` | Permanently deletes a contact from the address book. | `contactId`*, `accountId` |

## OneDrive

| Tool | Descrição | Parâmetros |
|---|---|---|
| `list_drive_items` | Lists files and folders inside a OneDrive folder. Omit both folderId and path to list the root. Results include type (file/folder), size and last modified date. | `folderId`, `path`, `top`, `nextLink`, `accountId` |
| `search_drive` | Searches OneDrive for files and folders by name or content. | `query`*, `top`, `nextLink`, `accountId` |
| `get_drive_item` | Gets metadata of a OneDrive file or folder (name, size, type, last modified, web URL). | `itemId`, `path`, `accountId` |
| `list_recent_files` | Lists the most recently accessed files in OneDrive. | `top`, `accountId` |
| `list_shared_with_me` | Lists files and folders that others have shared with the account. | `top`, `accountId` |
| `download_file` | Downloads the content of a OneDrive file and returns it as base64. Limited to files ≤ 4 MB. For larger files, use the webUrl returned by get_drive_item. | `itemId`, `path`, `accountId` |
| `upload_file` | Uploads a file to OneDrive. Provide the destination path and file content as base64. Files ≤ 4 MB are uploaded in a single request; larger files use a chunked upload session. conflictBehavior controls what happens if a file already exists at the path. | `path`*, `contentBase64`*, `conflictBehavior`, `accountId` |
| `create_folder` | Creates a new folder in OneDrive. If a folder with that name already exists, the new one is auto-renamed. | `name`*, `parentId`, `parentPath`, `accountId` |
| `move_item` | Moves and/or renames a OneDrive file or folder. Provide at least one of: destinationParentId, destinationParentPath, or newName. | `itemId`, `path`, `destinationParentId`, `destinationParentPath`, `newName`, `accountId` |
| `delete_item` | Moves a OneDrive file or folder to the Recycle Bin. The item can be restored from there. | `itemId`, `path`, `accountId` |
| `create_share_link` | Generates a sharing link for a OneDrive file or folder. type 'view' = read-only, 'edit' = read-write. scope 'anonymous' = anyone with the link, 'organization' = only people in the same org (work accounts only). | `itemId`, `path`, `type`, `scope`, `accountId` |

