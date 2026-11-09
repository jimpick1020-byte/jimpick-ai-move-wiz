/** Keep existing customer links; rotate only a new revision's conflicting token. */
export async function saveTermsWithStableToken<T>(options: {
  token: string;
  existingToken: () => Promise<string | null>;
  freshToken: () => string;
  save: (token: string) => Promise<{ data: T | null; error: { code?: string; message: string } | null }>;
}) {
  const existing = await options.existingToken();
  let token = existing ?? options.token;
  let result = await options.save(token);
  // Never treat permissions, network errors, or another constraint as a token collision.
  if (result.error?.code === "23505" && result.error.message.includes("estimate_terms_access_token_key")) {
    // A concurrent save may have created this exact revision. Reuse its link if so.
    token = (await options.existingToken()) ?? options.freshToken();
    result = await options.save(token);
  }
  return { ...result, token };
}