import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type VercelRedeployResult = {
  ok: boolean;
  method?: 'hook' | 'api';
  deploymentId?: string;
  message?: string;
};

async function readFunctionError(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    const body = await error.context.json();
    if (body && typeof body === 'object' && 'error' in body && body.error) {
      return String(body.error);
    }
  } catch {
    // ignore parse failures
  }
  return null;
}

export async function triggerVercelRedeploy(): Promise<VercelRedeployResult> {
  try {
    const { data, error } = await supabase.functions.invoke<VercelRedeployResult & { error?: string }>(
      'vercel-redeploy',
    );

    if (error) {
      const detail = await readFunctionError(error);
      return { ok: false, message: detail ?? error.message };
    }

    if (data?.error) {
      return { ok: false, message: data.error };
    }

    if (data?.ok) {
      return {
        ok: true,
        method: data.method,
        deploymentId: data.deploymentId,
        message: 'Vercel production redeploy started.',
      };
    }

    return { ok: false, message: 'Unexpected redeploy response from server.' };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Could not trigger Vercel redeploy.',
    };
  }
}
