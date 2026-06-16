import type { Client } from "@microsoft/microsoft-graph-client";
import type {
  Event,
  Attendee,
  Calendar,
  MeetingTimeSuggestionsResult,
} from "@microsoft/microsoft-graph-types";

// ── Field selectors ──────────────────────────────────────────────────────────

const EVENT_SUMMARY_FIELDS =
  "id,subject,start,end,isAllDay,location,organizer,attendees," +
  "onlineMeetingUrl,responseStatus,bodyPreview,categories,webLink,isOnlineMeeting";

const EVENT_FULL_FIELDS =
  "id,subject,start,end,isAllDay,location,body,organizer,attendees," +
  "onlineMeetingUrl,responseStatus,categories,webLink,recurrence," +
  "isOnlineMeeting,reminderMinutesBeforeStart,isCancelled,sensitivity";

const CALENDAR_FIELDS = "id,name,color,isDefaultCalendar,canEdit,owner";

// ── Types ────────────────────────────────────────────────────────────────────

export interface EventAttendeeInput {
  email: string;
  name?: string;
  type?: "required" | "optional";
}

export interface RecurrencePattern {
  pattern: {
    type: "daily" | "weekly" | "absoluteMonthly" | "relativeMonthly" | "absoluteYearly" | "relativeYearly";
    interval: number;
    daysOfWeek?: string[];
    dayOfMonth?: number;
    month?: number;
  };
  range: {
    type: "endDate" | "noEnd" | "numbered";
    startDate: string;
    endDate?: string;
    numberOfOccurrences?: number;
  };
}

export interface CreateEventInput {
  subject: string;
  start: string;
  end: string;
  timeZone?: string;
  isAllDay?: boolean;
  body?: string;
  location?: string;
  attendees?: EventAttendeeInput[];
  isOnlineMeeting?: boolean;
  reminderMinutesBeforeStart?: number;
  recurrence?: RecurrencePattern;
  calendarId?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toAttendeeList(inputs: EventAttendeeInput[]): Attendee[] {
  return inputs.map((a) => ({
    emailAddress: { address: a.email, ...(a.name && { name: a.name }) },
    type: a.type ?? "required",
  }));
}

function minutesToIsoDuration(minutes: number): string {
  if (minutes < 60) return `PT${minutes}M`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `PT${h}H${m}M` : `PT${h}H`;
}

function buildEventBody(input: CreateEventInput): Record<string, unknown> {
  const tz = input.timeZone ?? "UTC";
  const body: Record<string, unknown> = {
    subject: input.subject,
    start: { dateTime: input.start, timeZone: tz },
    end: { dateTime: input.end, timeZone: tz },
  };

  if (input.isAllDay !== undefined) body.isAllDay = input.isAllDay;
  if (input.body) body.body = { contentType: "Text", content: input.body };
  if (input.location) body.location = { displayName: input.location };
  if (input.attendees?.length) body.attendees = toAttendeeList(input.attendees);
  if (input.isOnlineMeeting !== undefined) body.isOnlineMeeting = input.isOnlineMeeting;
  if (input.reminderMinutesBeforeStart !== undefined) {
    body.isReminderOn = true;
    body.reminderMinutesBeforeStart = input.reminderMinutesBeforeStart;
  }
  if (input.recurrence) body.recurrence = input.recurrence;

  return body;
}

// ── Listing & view ───────────────────────────────────────────────────────────

export async function listEvents(
  client: Client,
  params: {
    startDateTime: string;
    endDateTime: string;
    timeZone?: string;
    calendarId?: string;
    top?: number;
    nextLink?: string;
  }
): Promise<{ items: Partial<Event>[]; nextLink?: string }> {
  const tz = params.timeZone ?? "UTC";

  let response: { value: Partial<Event>[]; "@odata.nextLink"?: string };

  if (params.nextLink) {
    response = (await client
      .api(params.nextLink)
      .header("Prefer", `outlook.timezone="${tz}"`)
      .get()) as typeof response;
  } else {
    const base = params.calendarId
      ? `/me/calendars/${params.calendarId}/calendarView`
      : "/me/calendarView";

    response = (await client
      .api(base)
      .query({
        startDateTime: params.startDateTime,
        endDateTime: params.endDateTime,
      })
      .header("Prefer", `outlook.timezone="${tz}"`)
      .select(EVENT_SUMMARY_FIELDS)
      .top(params.top ?? 50)
      .orderby("start/dateTime")
      .get()) as typeof response;
  }

  return {
    items: response.value ?? [],
    nextLink: response["@odata.nextLink"],
  };
}

export async function getEvent(
  client: Client,
  params: { eventId: string; timeZone?: string }
): Promise<Partial<Event>> {
  const tz = params.timeZone ?? "UTC";
  return client
    .api(`/me/events/${params.eventId}`)
    .header("Prefer", `outlook.timezone="${tz}"`)
    .select(EVENT_FULL_FIELDS)
    .get() as Promise<Partial<Event>>;
}

// ── Create & update ───────────────────────────────────────────────────────────

export async function createEvent(
  client: Client,
  input: CreateEventInput
): Promise<Partial<Event>> {
  const endpoint = input.calendarId
    ? `/me/calendars/${input.calendarId}/events`
    : "/me/events";

  return client
    .api(endpoint)
    .post(buildEventBody(input)) as Promise<Partial<Event>>;
}

export async function updateEvent(
  client: Client,
  params: { eventId: string } & Partial<CreateEventInput>
): Promise<Partial<Event>> {
  const { eventId, ...rest } = params;
  const patch: Record<string, unknown> = {};
  const tz = rest.timeZone ?? "UTC";

  if (rest.subject !== undefined) patch.subject = rest.subject;
  if (rest.start !== undefined) patch.start = { dateTime: rest.start, timeZone: tz };
  if (rest.end !== undefined) patch.end = { dateTime: rest.end, timeZone: tz };
  if (rest.isAllDay !== undefined) patch.isAllDay = rest.isAllDay;
  if (rest.body !== undefined) patch.body = { contentType: "Text", content: rest.body };
  if (rest.location !== undefined) patch.location = { displayName: rest.location };
  if (rest.attendees !== undefined) patch.attendees = toAttendeeList(rest.attendees);
  if (rest.isOnlineMeeting !== undefined) patch.isOnlineMeeting = rest.isOnlineMeeting;
  if (rest.reminderMinutesBeforeStart !== undefined) {
    patch.isReminderOn = true;
    patch.reminderMinutesBeforeStart = rest.reminderMinutesBeforeStart;
  }
  if (rest.recurrence !== undefined) patch.recurrence = rest.recurrence;

  return client
    .api(`/me/events/${eventId}`)
    .patch(patch) as Promise<Partial<Event>>;
}

export async function deleteEvent(
  client: Client,
  params: { eventId: string }
): Promise<void> {
  await client.api(`/me/events/${params.eventId}`).delete();
}

// ── Responses ────────────────────────────────────────────────────────────────

type EventResponse = "accept" | "decline" | "tentativelyAccept";

export async function respondToEvent(
  client: Client,
  params: {
    eventId: string;
    response: EventResponse;
    comment?: string;
    sendResponse?: boolean;
  }
): Promise<void> {
  await client.api(`/me/events/${params.eventId}/${params.response}`).post({
    comment: params.comment ?? "",
    sendResponse: params.sendResponse ?? true,
  });
}

// ── Calendars ────────────────────────────────────────────────────────────────

export async function listCalendars(
  client: Client
): Promise<Partial<Calendar>[]> {
  const response = (await client
    .api("/me/calendars")
    .select(CALENDAR_FIELDS)
    .get()) as { value: Partial<Calendar>[] };
  return response.value ?? [];
}

// ── Meeting times ─────────────────────────────────────────────────────────────

export async function findMeetingTimes(
  client: Client,
  params: {
    attendees: string[];
    durationMinutes: number;
    timeWindowStart: string;
    timeWindowEnd: string;
    timeZone?: string;
  }
): Promise<MeetingTimeSuggestionsResult> {
  const tz = params.timeZone ?? "UTC";

  const body = {
    attendees: params.attendees.map((address) => ({
      emailAddress: { address },
      type: "required",
    })),
    timeConstraint: {
      activityDomain: "work",
      timeslots: [
        {
          start: { dateTime: params.timeWindowStart, timeZone: tz },
          end: { dateTime: params.timeWindowEnd, timeZone: tz },
        },
      ],
    },
    meetingDuration: minutesToIsoDuration(params.durationMinutes),
    returnSuggestionReasons: true,
    minimumAttendeePercentage: 100,
  };

  return client
    .api("/me/findMeetingTimes")
    .post(body) as Promise<MeetingTimeSuggestionsResult>;
}
