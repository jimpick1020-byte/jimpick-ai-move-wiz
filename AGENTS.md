<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The home contract calendar uses one authenticated company-scoped server query and opens contracts by `estimate_id`; this prevents cross-company or duplicate schedule entries.
- Reservation stages come from `reservation-status.ts`: customer consent is a request, confirmed deposit is confirmation, and full payment is completion; this prevents consent from falsely appearing as payment confirmation.
- The company subscription price has one source of truth in `PLANS` at KRW 30,000 monthly; Toss charges and renewal displays must read that value to prevent price drift.
- The Step6 room picker uses a full-viewport flex layout with one vertical list scroller and a separate RoomPickedStrip reading the same room items and disposal map; this prevents overlapping controls and divergent selection state.
- Worker contacts are stored in company-owned profiles and changed through locked security-invoker RPCs; assignment stores contact IDs in draft JSON so management and sending read one contact source.

- AI SDK imports `@vercel/oidc`, which uses Node-only `createRequire(import.meta.url)` and crashes the Cloudflare worker at startup; `vite.config.ts` aliases it to `src/lib/vercel-oidc-stub.ts` — keep this alias.
