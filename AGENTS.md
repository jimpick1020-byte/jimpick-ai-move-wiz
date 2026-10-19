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
- The Step6 room picker keeps its base list mounted behind history-backed ItemListLayer views and RoomPickedStrip; all read draft rooms and disposal maps and use one locked immediate-save path, preserving scroll and preventing divergent selections.
- Step6 direct-selection back buttons and swipes return to the scan screen before Step3; this preserves sequential navigation within the shared fourth step.
- Favorite-card selection behavior is isolated by ItemListLayer mode and uses the existing quantity-save callback; this prevents changes to category and picked views or separate selection state.
- Manual company items reuse item_icons and the existing stable image route through an authenticated owner-scoped insert before narrow storage upload; this preserves catalog IDs and avoids duplicate item tables.
- Worker contacts are stored in company-owned profiles and changed through locked security-invoker RPCs; assignment stores contact IDs in draft JSON so management and sending read one contact source.
- Worker work-category grouping uses shared helpers with the existing JSON gender encoding (male for male work, female for kitchen work); legacy female contacts map to kitchen and unspecified contacts fall back to their role without rewriting stored records, preserving IDs and RPC compatibility.

- AI SDK imports `@vercel/oidc`, which uses Node-only `createRequire(import.meta.url)` and crashes the Cloudflare worker at startup; `vite.config.ts` aliases it to `src/lib/vercel-oidc-stub.ts` — keep this alias.
- Worker contacts are never hard-deleted; deletion sets disabled in the profile JSON via disable_worker_contact so past contracts and staff-share records stay intact.
- Staff-share links are created only when the latest estimate_terms payment_status confirms the deposit; the UI and server both check stored status, not displayed amounts.
- Deposit-waiting history navigation carries estimate_id in session storage and validates it against the current company list and stored reservation stage; highlighting must disappear when payment is confirmed.
- Telephone inputs, draft saves, company defaults and worker RPCs use formatTel for stored/display values; SMS transport alone strips separators, preserving legacy records on reads.
- Auth persistence preserves existing durable sessions during refresh; Google sets persistence before OAuth so reopening cannot downgrade stored tokens to tab-only storage.
- JimpickProvider owns the sole app auth subscription, waits for validated startup recovery, and cancels/clears private query caches before explicit sign-out; this avoids login flashes and duplicate sign-outs.

- Subdirectories have their own `AGENTS.md` (e.g. `src/lib/AGENTS.md` for customer intake); read it before changing files there.
- Direct selection and room scan reuse StepHero/CharacterGuide; quantity cards share a scoped quantity-selected style without changing counter or persistence logic, preventing layout and selection drift.
- Shared address selection appends provider-returned building names to the existing address string through address-label; this preserves names across intake, estimates and saved drafts without changing coordinates or detail fields.

- Deposit acknowledgement uses confirm_payment_receipt; explicit balance completion uses the owner-locked complete_estimate_payment RPC with separate methods and shared pendingReceipt display, preventing cash fallback, total changes or messaging side effects.
- Automatic receipt highlighting uses explicit bank methods or known legacy bank-alert sources; receipt-free bank balance confirmation uses an explicit owner-reviewed, expected-amount-checked security-invoker RPC that creates an audited confirmed receipt and delegates to the existing completion RPC, without assuming access to phone SMS.
- Pending bank receipts stay directly visible in DepositPanel and use its existing locked confirmation path; registration is separate so confirmation never requires re-entering evidence or reselecting a payment method.
