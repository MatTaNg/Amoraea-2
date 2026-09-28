/** Auth for create-signup-lead: server secret and/or public anon key (Audos browser POST). */
export function authorizeSignupLeadCreateRequest(req: Request): boolean {
  const configuredSecret = Deno.env.get('SIGNUP_LEAD_CREATE_SECRET')?.trim();
  const providedSecret = req.headers.get('x-signup-lead-secret')?.trim();
  if (configuredSecret && providedSecret === configuredSecret) {
    return true;
  }

  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (anonKey) {
    const authHeader = req.headers.get('Authorization')?.trim() ?? '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const apikey = req.headers.get('apikey')?.trim();
    if (bearer === anonKey || apikey === anonKey) {
      return true;
    }
  }

  if (!configuredSecret) {
    return true;
  }

  return false;
}
