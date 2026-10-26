/** Lead và lớp học thử (Giai đoạn 12c). Chỉ staff đọc/ghi. */
import type { ErpClient } from './client';
import type { Tables } from './database.types';
import { unwrap } from './queries';

export const leadStatuses = ['new', 'contacted', 'trial', 'won', 'lost'] as const;
export type LeadStatus = (typeof leadStatuses)[number];

export type Lead = Tables<'leads'> & {
  trial: { starts_at: string; ends_at: string } | null;
};

export type LeadInput = {
  academyId: string;
  name: string;
  phone?: string;
  email?: string;
  childName?: string;
  childAge?: number | null;
  source?: string;
  note?: string;
  assignedTo?: string | null;
};

export async function fetchLeads(client: ErpClient, academyId: string): Promise<Lead[]> {
  return unwrap(
    await client
      .from('leads')
      .select('*, trial:calendar_events!leads_trial_event_id_fkey(starts_at, ends_at)')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false }),
  ) as Lead[];
}

export async function createLead(
  client: ErpClient,
  userId: string,
  input: LeadInput,
): Promise<string> {
  const row = unwrap(
    await client
      .from('leads')
      .insert({
        academy_id: input.academyId,
        name: input.name.trim(),
        phone: input.phone?.trim() ?? '',
        email: input.email?.trim() ?? '',
        child_name: input.childName?.trim() ?? '',
        child_age: input.childAge ?? null,
        source: input.source?.trim() ?? '',
        note: input.note?.trim() ?? '',
        assigned_to: input.assignedTo ?? null,
        created_by: userId,
      })
      .select('id')
      .single(),
  );
  return row.id;
}

export async function updateLead(
  client: ErpClient,
  id: string,
  patch: Partial<{ status: LeadStatus; note: string; assigned_to: string | null }>,
): Promise<void> {
  unwrap(await client.from('leads').update(patch).eq('id', id));
}

export async function deleteLead(client: ErpClient, id: string): Promise<void> {
  unwrap(await client.from('leads').delete().eq('id', id));
}

/** Tạo sự kiện lịch "học thử" và gắn vào lead. Trả id sự kiện. */
export async function scheduleTrial(
  client: ErpClient,
  input: { leadId: string; startsAt: string; endsAt: string; coachId?: string | null },
): Promise<string> {
  return unwrap(
    await client.rpc('schedule_trial', {
      p_lead: input.leadId,
      p_starts: input.startsAt,
      p_ends: input.endsAt,
      p_coach: input.coachId ?? undefined,
    }),
  );
}

/** Owner bật/tắt tính năng Lead của học viện. */
export async function setLeadsEnabled(client: ErpClient, academyId: string, enabled: boolean) {
  unwrap(await client.from('academies').update({ leads_enabled: enabled }).eq('id', academyId));
}
