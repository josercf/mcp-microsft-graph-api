import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getGraphClient } from "../graph/client.js";
import { toolResult, toolError } from "../utils/errors.js";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  respondToEvent,
  listCalendars,
  findMeetingTimes,
} from "../graph/calendar.js";

const accountIdField = z
  .string()
  .optional()
  .describe("Account to use. Defaults to the default account.");

const calendarIdField = z
  .string()
  .optional()
  .describe("Calendar ID. Defaults to the primary calendar.");

const timeZoneField = z
  .string()
  .optional()
  .describe("IANA time zone (e.g. 'America/Sao_Paulo'). Defaults to UTC.");

const attendeeSchema = z.object({
  email: z.string().email().describe("Attendee email address."),
  name: z.string().optional().describe("Attendee display name."),
  type: z
    .enum(["required", "optional"])
    .optional()
    .describe("Attendance type. Default: required."),
});

const recurrenceSchema = z.object({
  pattern: z.object({
    type: z.enum([
      "daily",
      "weekly",
      "absoluteMonthly",
      "relativeMonthly",
      "absoluteYearly",
      "relativeYearly",
    ]),
    interval: z.number().int().min(1).describe("Recurrence interval (e.g. 1 = every week)."),
    daysOfWeek: z
      .array(z.string())
      .optional()
      .describe("Days of the week for weekly recurrence (e.g. ['monday','wednesday'])."),
    dayOfMonth: z.number().int().optional().describe("Day of month for monthly recurrence."),
    month: z.number().int().optional().describe("Month number for yearly recurrence."),
  }),
  range: z.object({
    type: z.enum(["endDate", "noEnd", "numbered"]),
    startDate: z.string().describe("Start date YYYY-MM-DD."),
    endDate: z.string().optional().describe("End date YYYY-MM-DD (for endDate type)."),
    numberOfOccurrences: z
      .number()
      .int()
      .optional()
      .describe("Number of occurrences (for numbered type)."),
  }),
});

export function registerCalendarTools(server: McpServer): void {
  // ── list_events ────────────────────────────────────────────────────────────
  server.tool(
    "list_events",
    "Lists calendar events in a date/time range. Recurring events are expanded into individual occurrences. " +
      "Order: chronological by start time.",
    {
      startDateTime: z
        .string()
        .describe("Range start (ISO 8601, e.g. '2026-06-16T00:00:00')."),
      endDateTime: z
        .string()
        .describe("Range end (ISO 8601, e.g. '2026-06-16T23:59:59')."),
      timeZone: timeZoneField,
      calendarId: calendarIdField,
      top: z.number().int().min(1).max(200).optional().describe("Max results. Default: 50."),
      nextLink: z.string().optional().describe("Pagination cursor from a previous response."),
      accountId: accountIdField,
    },
    async ({ startDateTime, endDateTime, timeZone, calendarId, top, nextLink, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const result = await listEvents(client, {
          startDateTime,
          endDateTime,
          timeZone,
          calendarId,
          top,
          nextLink,
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── get_event ──────────────────────────────────────────────────────────────
  server.tool(
    "get_event",
    "Gets the full details of a calendar event including body, all attendees and recurrence pattern.",
    {
      eventId: z.string().describe("Event ID."),
      timeZone: timeZoneField,
      accountId: accountIdField,
    },
    async ({ eventId, timeZone, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const event = await getEvent(client, { eventId, timeZone });
        return toolResult(event);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── create_event ───────────────────────────────────────────────────────────
  server.tool(
    "create_event",
    "Creates a new calendar event. Invite attendees by email — they will receive an invitation. " +
      "Set isOnlineMeeting=true to auto-generate a Teams meeting link.",
    {
      subject: z.string().describe("Event title."),
      start: z
        .string()
        .describe("Start date/time (ISO 8601, e.g. '2026-06-20T14:00:00')."),
      end: z
        .string()
        .describe("End date/time (ISO 8601, e.g. '2026-06-20T15:00:00')."),
      timeZone: timeZoneField,
      isAllDay: z
        .boolean()
        .optional()
        .describe("All-day event. Omit times if true. Default: false."),
      body: z.string().optional().describe("Event description/notes."),
      location: z.string().optional().describe("Physical or virtual location."),
      attendees: z.array(attendeeSchema).optional().describe("Attendees to invite."),
      isOnlineMeeting: z
        .boolean()
        .optional()
        .describe("Generate a Teams online meeting link. Default: false."),
      reminderMinutesBeforeStart: z
        .number()
        .int()
        .optional()
        .describe("Reminder time in minutes before the event."),
      recurrence: recurrenceSchema.optional().describe("Recurrence rule for repeating events."),
      calendarId: calendarIdField,
      accountId: accountIdField,
    },
    async ({
      subject,
      start,
      end,
      timeZone,
      isAllDay,
      body,
      location,
      attendees,
      isOnlineMeeting,
      reminderMinutesBeforeStart,
      recurrence,
      calendarId,
      accountId,
    }) => {
      try {
        const client = getGraphClient(accountId);
        const event = await createEvent(client, {
          subject,
          start,
          end,
          timeZone,
          isAllDay,
          body,
          location,
          attendees,
          isOnlineMeeting,
          reminderMinutesBeforeStart,
          recurrence,
          calendarId,
        });
        return toolResult({
          id: event.id,
          subject: event.subject,
          start: event.start,
          end: event.end,
          webLink: event.webLink,
          onlineMeetingUrl: event.onlineMeetingUrl,
        });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── update_event ───────────────────────────────────────────────────────────
  server.tool(
    "update_event",
    "Updates one or more fields of an existing calendar event. Only provided fields are changed.",
    {
      eventId: z.string().describe("Event ID to update."),
      subject: z.string().optional(),
      start: z.string().optional().describe("New start (ISO 8601)."),
      end: z.string().optional().describe("New end (ISO 8601)."),
      timeZone: timeZoneField,
      isAllDay: z.boolean().optional(),
      body: z.string().optional(),
      location: z.string().optional(),
      attendees: z.array(attendeeSchema).optional(),
      isOnlineMeeting: z.boolean().optional(),
      reminderMinutesBeforeStart: z.number().int().optional(),
      recurrence: recurrenceSchema.optional(),
      accountId: accountIdField,
    },
    async ({
      eventId,
      subject,
      start,
      end,
      timeZone,
      isAllDay,
      body,
      location,
      attendees,
      isOnlineMeeting,
      reminderMinutesBeforeStart,
      recurrence,
      accountId,
    }) => {
      try {
        const client = getGraphClient(accountId);
        const event = await updateEvent(client, {
          eventId,
          subject,
          start,
          end,
          timeZone,
          isAllDay,
          body,
          location,
          attendees,
          isOnlineMeeting,
          reminderMinutesBeforeStart,
          recurrence,
        });
        return toolResult({
          id: event.id,
          subject: event.subject,
          start: event.start,
          end: event.end,
        });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── delete_event ───────────────────────────────────────────────────────────
  server.tool(
    "delete_event",
    "Deletes a calendar event. Attendees will receive a cancellation notice.",
    {
      eventId: z.string().describe("Event ID to delete."),
      accountId: accountIdField,
    },
    async ({ eventId, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        await deleteEvent(client, { eventId });
        return toolResult({ deleted: true });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── respond_to_event ───────────────────────────────────────────────────────
  server.tool(
    "respond_to_event",
    "Responds to a meeting invitation: accept, decline or mark as tentative. " +
      "Cannot be used on events you organise yourself.",
    {
      eventId: z.string().describe("Event ID to respond to."),
      response: z
        .enum(["accept", "decline", "tentativelyAccept"])
        .describe("Your response to the invitation."),
      comment: z
        .string()
        .optional()
        .describe("Optional message to include with the response."),
      sendResponse: z
        .boolean()
        .optional()
        .describe("Send the response to the organiser. Default: true."),
      accountId: accountIdField,
    },
    async ({ eventId, response, comment, sendResponse, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        await respondToEvent(client, { eventId, response, comment, sendResponse });
        return toolResult({ responded: true, response });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── list_calendars ─────────────────────────────────────────────────────────
  server.tool(
    "list_calendars",
    "Lists all calendars in the account (personal, shared, subscribed).",
    { accountId: accountIdField },
    async ({ accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const calendars = await listCalendars(client);
        return toolResult({ calendars, total: calendars.length });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── find_meeting_times ─────────────────────────────────────────────────────
  server.tool(
    "find_meeting_times",
    "Suggests available meeting time slots when all specified attendees are free. " +
      "Returns a ranked list of suggestions with confidence scores.",
    {
      attendees: z
        .array(z.string().email())
        .min(1)
        .describe("Email addresses of required attendees."),
      durationMinutes: z
        .number()
        .int()
        .min(1)
        .describe("Desired meeting duration in minutes."),
      timeWindowStart: z
        .string()
        .describe("Start of the search window (ISO 8601)."),
      timeWindowEnd: z
        .string()
        .describe("End of the search window (ISO 8601)."),
      timeZone: timeZoneField,
      accountId: accountIdField,
    },
    async ({
      attendees,
      durationMinutes,
      timeWindowStart,
      timeWindowEnd,
      timeZone,
      accountId,
    }) => {
      try {
        const client = getGraphClient(accountId);
        const result = await findMeetingTimes(client, {
          attendees,
          durationMinutes,
          timeWindowStart,
          timeWindowEnd,
          timeZone,
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
