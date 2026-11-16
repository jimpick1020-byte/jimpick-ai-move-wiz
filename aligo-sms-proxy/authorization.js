/** Called only behind the shared-secret gate; authorize purpose before any provider call. */
export async function authorizeSms(body, read) {
  const company = String(body?.companyId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(company)) return false;
  if (body?.purpose === "owner_reservation") {
    if (!body.estimateId) return false;
    const terms = await read("estimate_terms", { estimate_id: `eq.${body.estimateId}`, user_id: `eq.${company}`, deleted_at: "is.null", select: "id", order: "sheet_version.desc", limit: "1" });
    const term = terms?.[0];
    if (!term) return false;
    const acceptance = await read("terms_acceptances", { estimate_terms_id: `eq.${term.id}`, accepted: "eq.true", select: "id", limit: "1" });
    const profiles = await read("profiles", { id: `eq.${company}`, select: "phone", limit: "1" });
    const phone = String(profiles?.[0]?.phone ?? "").replace(/\D/g, "");
    return !!acceptance?.length && !!phone && phone === String(body.to ?? "").replace(/\D/g, "");
  }
  if (body?.purpose !== "customer") return false;
  const actor = String(body.actorId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(actor)) return false;
  const roles = await read("user_roles", { user_id: `eq.${actor}`, role: "eq.super_admin", select: "id", limit: "1" });
  return !!roles?.length;
}