import type { Client } from "@microsoft/microsoft-graph-client";
import type { Contact } from "@microsoft/microsoft-graph-types";

// ── Field selectors ──────────────────────────────────────────────────────────

const CONTACT_SUMMARY_FIELDS =
  "id,displayName,givenName,surname,emailAddresses,mobilePhone," +
  "businessPhones,companyName,jobTitle";

const CONTACT_FULL_FIELDS =
  "id,displayName,givenName,surname,emailAddresses,mobilePhone," +
  "businessPhones,companyName,jobTitle,department,officeLocation," +
  "homeAddress,businessAddress,birthday,personalNotes,categories";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreateContactInput {
  givenName?: string;
  surname?: string;
  displayName?: string;
  emailAddresses?: { address: string; name?: string }[];
  mobilePhone?: string;
  businessPhones?: string[];
  companyName?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  notes?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildContactBody(input: CreateContactInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (input.givenName) body.givenName = input.givenName;
  if (input.surname) body.surname = input.surname;
  if (input.displayName) body.displayName = input.displayName;
  if (input.emailAddresses?.length) {
    body.emailAddresses = input.emailAddresses.map((e) => ({
      address: e.address,
      name: e.name ?? e.address,
    }));
  }
  if (input.mobilePhone) body.mobilePhone = input.mobilePhone;
  if (input.businessPhones?.length) body.businessPhones = input.businessPhones;
  if (input.companyName) body.companyName = input.companyName;
  if (input.jobTitle) body.jobTitle = input.jobTitle;
  if (input.department) body.department = input.department;
  if (input.officeLocation) body.officeLocation = input.officeLocation;
  if (input.notes) body.personalNotes = input.notes;

  return body;
}

// ── Operations ────────────────────────────────────────────────────────────────

export async function listContacts(
  client: Client,
  params: { top?: number; nextLink?: string }
): Promise<{ items: Partial<Contact>[]; nextLink?: string }> {
  let response: { value: Partial<Contact>[]; "@odata.nextLink"?: string };

  if (params.nextLink) {
    response = (await client.api(params.nextLink).get()) as typeof response;
  } else {
    response = (await client
      .api("/me/contacts")
      .select(CONTACT_SUMMARY_FIELDS)
      .top(params.top ?? 50)
      .orderby("displayName")
      .get()) as typeof response;
  }

  return {
    items: response.value ?? [],
    nextLink: response["@odata.nextLink"],
  };
}

export async function searchContacts(
  client: Client,
  params: { query: string; top?: number; nextLink?: string }
): Promise<{ items: Partial<Contact>[]; nextLink?: string }> {
  let response: { value: Partial<Contact>[]; "@odata.nextLink"?: string };

  if (params.nextLink) {
    response = (await client.api(params.nextLink).get()) as typeof response;
  } else {
    // $search on contacts requires ConsistencyLevel: eventual
    response = (await client
      .api("/me/contacts")
      .header("ConsistencyLevel", "eventual")
      .search(`"${params.query}"`)
      .select(CONTACT_SUMMARY_FIELDS)
      .top(params.top ?? 25)
      .get()) as typeof response;
  }

  return {
    items: response.value ?? [],
    nextLink: response["@odata.nextLink"],
  };
}

export async function getContact(
  client: Client,
  params: { contactId: string }
): Promise<Partial<Contact>> {
  return client
    .api(`/me/contacts/${params.contactId}`)
    .select(CONTACT_FULL_FIELDS)
    .get() as Promise<Partial<Contact>>;
}

export async function createContact(
  client: Client,
  input: CreateContactInput
): Promise<Partial<Contact>> {
  if (!input.givenName && !input.surname && !input.displayName) {
    throw new Error(
      "CONTACT_NEEDS_NAME: At least one of givenName, surname or displayName is required."
    );
  }
  return client
    .api("/me/contacts")
    .post(buildContactBody(input)) as Promise<Partial<Contact>>;
}

export async function updateContact(
  client: Client,
  params: { contactId: string } & Partial<CreateContactInput>
): Promise<Partial<Contact>> {
  const { contactId, ...rest } = params;
  const body: Record<string, unknown> = {};

  if (rest.givenName !== undefined) body.givenName = rest.givenName;
  if (rest.surname !== undefined) body.surname = rest.surname;
  if (rest.displayName !== undefined) body.displayName = rest.displayName;
  if (rest.emailAddresses !== undefined) {
    body.emailAddresses = rest.emailAddresses.map((e) => ({
      address: e.address,
      name: e.name ?? e.address,
    }));
  }
  if (rest.mobilePhone !== undefined) body.mobilePhone = rest.mobilePhone;
  if (rest.businessPhones !== undefined) body.businessPhones = rest.businessPhones;
  if (rest.companyName !== undefined) body.companyName = rest.companyName;
  if (rest.jobTitle !== undefined) body.jobTitle = rest.jobTitle;
  if (rest.department !== undefined) body.department = rest.department;
  if (rest.officeLocation !== undefined) body.officeLocation = rest.officeLocation;
  if (rest.notes !== undefined) body.personalNotes = rest.notes;

  return client
    .api(`/me/contacts/${contactId}`)
    .patch(body) as Promise<Partial<Contact>>;
}

export async function deleteContact(
  client: Client,
  params: { contactId: string }
): Promise<void> {
  await client.api(`/me/contacts/${params.contactId}`).delete();
}
