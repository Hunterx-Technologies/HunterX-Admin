// Server Actions must not throw for expected failures: in production builds
// Next.js replaces a thrown error's message with a generic "An error occurred
// in the Server Components render…", so the backend's reason (validation,
// XP cap, …) never reaches the form. Actions return an ActionResult instead,
// and the client calls unwrapAction() to get the value or throw a plain Error
// in the browser, where the message survives.

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; status?: number };

export async function toActionResult<T>(run: () => Promise<T>, fallback: string): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (err) {
    const e = err as { message?: string; code?: string; status?: number };
    if (e?.status === 401) {
      return { ok: false, error: 'Your session has expired. Sign in again, then retry.', code: e.code, status: 401 };
    }
    return { ok: false, error: e?.message || fallback, code: e?.code, status: e?.status };
  }
}

export function unwrapAction<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
