/** Minimal Airtable REST client — just paginated reads. */

export interface AirtableAttachment {
  id: string;
  url: string;
  filename?: string;
  type?: string;
}

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

interface ListResponse {
  records: AirtableRecord[];
  offset?: string;
}

export interface ListOptions {
  filterByFormula?: string;
  fields?: string[];
}

export class AirtableError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function listAllRecords(
  token: string,
  baseId: string,
  table: string,
  options: ListOptions = {},
): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (options.filterByFormula) params.set('filterByFormula', options.filterByFormula);
    for (const field of options.fields ?? []) params.append('fields[]', field);
    if (offset) params.set('offset', offset);

    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new AirtableError(res.status, `Airtable ${table}: ${res.status} ${body.slice(0, 300)}`);
    }
    const page = (await res.json()) as ListResponse;
    records.push(...page.records);
    offset = page.offset;
  } while (offset);

  return records;
}
