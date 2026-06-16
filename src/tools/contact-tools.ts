import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getGraphClient } from "../graph/client.js";
import { toolResult, toolError } from "../utils/errors.js";
import {
  listContacts,
  searchContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
} from "../graph/contacts.js";

const accountIdField = z
  .string()
  .optional()
  .describe("Account to use. Defaults to the default account.");

const emailAddressSchema = z.object({
  address: z.string().email().describe("Email address."),
  name: z.string().optional().describe("Display name for this address."),
});

const contactFields = {
  givenName: z.string().optional().describe("First name."),
  surname: z.string().optional().describe("Last name."),
  displayName: z.string().optional().describe("Full display name (overrides givenName + surname)."),
  emailAddresses: z.array(emailAddressSchema).optional().describe("Email addresses."),
  mobilePhone: z.string().optional().describe("Mobile phone number."),
  businessPhones: z.array(z.string()).optional().describe("Business phone numbers."),
  companyName: z.string().optional().describe("Company/organisation name."),
  jobTitle: z.string().optional().describe("Job title."),
  department: z.string().optional().describe("Department."),
  officeLocation: z.string().optional().describe("Office location."),
  notes: z.string().optional().describe("Personal notes about the contact."),
};

export function registerContactTools(server: McpServer): void {
  // ── list_contacts ──────────────────────────────────────────────────────────
  server.tool(
    "list_contacts",
    "Lists contacts in the account address book, ordered alphabetically by display name.",
    {
      top: z.number().int().min(1).max(200).optional().describe("Max results. Default: 50."),
      nextLink: z.string().optional().describe("Pagination cursor from a previous response."),
      accountId: accountIdField,
    },
    async ({ top, nextLink, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const result = await listContacts(client, { top, nextLink });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── search_contacts ────────────────────────────────────────────────────────
  server.tool(
    "search_contacts",
    "Searches contacts by name, email address, company or any other field using full-text search.",
    {
      query: z.string().describe("Search query (e.g. 'João', 'acme.com', 'Engineering')."),
      top: z.number().int().min(1).max(100).optional().describe("Max results. Default: 25."),
      nextLink: z.string().optional().describe("Pagination cursor from a previous response."),
      accountId: accountIdField,
    },
    async ({ query, top, nextLink, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const result = await searchContacts(client, { query, top, nextLink });
        return toolResult(result);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── get_contact ────────────────────────────────────────────────────────────
  server.tool(
    "get_contact",
    "Gets full details of a contact including addresses, notes and all phone numbers.",
    {
      contactId: z.string().describe("Contact ID (from list_contacts or search_contacts)."),
      accountId: accountIdField,
    },
    async ({ contactId, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        const contact = await getContact(client, { contactId });
        return toolResult(contact);
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── create_contact ─────────────────────────────────────────────────────────
  server.tool(
    "create_contact",
    "Creates a new contact. At least one of givenName, surname or displayName is required.",
    {
      ...contactFields,
      accountId: accountIdField,
    },
    async ({
      givenName,
      surname,
      displayName,
      emailAddresses,
      mobilePhone,
      businessPhones,
      companyName,
      jobTitle,
      department,
      officeLocation,
      notes,
      accountId,
    }) => {
      try {
        const client = getGraphClient(accountId);
        const contact = await createContact(client, {
          givenName,
          surname,
          displayName,
          emailAddresses,
          mobilePhone,
          businessPhones,
          companyName,
          jobTitle,
          department,
          officeLocation,
          notes,
        });
        return toolResult({ id: contact.id, displayName: contact.displayName });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── update_contact ─────────────────────────────────────────────────────────
  server.tool(
    "update_contact",
    "Updates one or more fields of an existing contact. Only provided fields are changed.",
    {
      contactId: z.string().describe("Contact ID to update."),
      ...contactFields,
      accountId: accountIdField,
    },
    async ({
      contactId,
      givenName,
      surname,
      displayName,
      emailAddresses,
      mobilePhone,
      businessPhones,
      companyName,
      jobTitle,
      department,
      officeLocation,
      notes,
      accountId,
    }) => {
      try {
        const client = getGraphClient(accountId);
        const contact = await updateContact(client, {
          contactId,
          givenName,
          surname,
          displayName,
          emailAddresses,
          mobilePhone,
          businessPhones,
          companyName,
          jobTitle,
          department,
          officeLocation,
          notes,
        });
        return toolResult({ id: contact.id, displayName: contact.displayName });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── delete_contact ─────────────────────────────────────────────────────────
  server.tool(
    "delete_contact",
    "Permanently deletes a contact from the address book.",
    {
      contactId: z.string().describe("Contact ID to delete."),
      accountId: accountIdField,
    },
    async ({ contactId, accountId }) => {
      try {
        const client = getGraphClient(accountId);
        await deleteContact(client, { contactId });
        return toolResult({ deleted: true });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
