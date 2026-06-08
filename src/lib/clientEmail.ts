import { FunctionsHttpError } from '@supabase/supabase-js';
import { ClientEmailTemplateId } from '../data/clientEmailTemplates';
import { supabase } from './supabase';

export type ClientEmailRecipient = {
  email: string;
  name: string;
};

export type SendClientEmailInput = {
  templateId: ClientEmailTemplateId;
  recipients: ClientEmailRecipient[];
  subject?: string;
  message?: string;
};

export type SendClientEmailResult = {
  ok: boolean;
  sent: number;
  skipped: number;
  failed: number;
  errors?: string[];
};

async function readFunctionError(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    const body = await error.context.json();
    if (body && typeof body === 'object') {
      if ('error' in body && body.error) return String(body.error);
      if ('message' in body && body.message) return String(body.message);
    }
  } catch {
    // ignore
  }
  return null;
}

export async function sendClientEmails(
  input: SendClientEmailInput,
): Promise<SendClientEmailResult> {
  const { data, error } = await supabase.functions.invoke<SendClientEmailResult & { error?: string }>(
    'client-contact-email',
    {
      method: 'POST',
      body: input,
    },
  );

  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }

  if (data?.error) throw new Error(data.error);

  return (
    data ?? {
      ok: false,
      sent: 0,
      skipped: 0,
      failed: 0,
    }
  );
}
