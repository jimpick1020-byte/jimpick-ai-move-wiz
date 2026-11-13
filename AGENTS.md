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
- PayApp keeps order-scoped entitlement/cancellation locks; only definite rejection unlocks creation. Returns read only; provider alone renews; verified same-day validity/card calendar gate billing. New orders snapshot exclusive expiry separately from paid access.
- The Step6 room picker keeps its base list mounted behind history-backed ItemListLayer views and RoomPickedStrip, all reading draft rooms via one optimistic serialized save queue (non-blocking, ignores server responses, rolls back to last saved); this preserves scroll and prevents divergent selections.
- Owner picker drag uses direct transforms and DOM drop hints, resolves release anchors against the displayed array, cancels on touchcancel, and serializes verified saves only for changed positions; this keeps long lists smooth and prevents stale/no-op success without changing estimate data.
- Owner scan navigation and sequential progress use ai-scan-setting helpers with a post-hydration account-scoped device preference; settings alone controls inclusion, keeping existing scans independent of the writing flow.
- Favorite-card selection behavior is isolated by ItemListLayer mode and uses the existing quantity-save callback; this prevents changes to category and picked views or separate selection state.
- Manual company items reuse item_icons and the existing stable image route through an authenticated owner-scoped insert before narrow storage upload; this preserves catalog IDs and avoids duplicate item tables.
- Worker contacts live in company-owned profiles, change only through locked security-invoker RPCs and are disabled (never hard-deleted) via disable_worker_contact; assignments store contact IDs in draft JSON, keeping one source and past records intact.
- Worker work-category grouping uses shared helpers with the existing JSON gender encoding (male for male work, female for kitchen work); legacy female contacts map to kitchen and unspecified contacts fall back to their role without rewriting stored records, preserving IDs and RPC compatibility.

- AI SDK imports `@vercel/oidc`, which uses Node-only `createRequire(import.meta.url)` and crashes the Cloudflare worker at startup; `vite.config.ts` aliases it to `src/lib/vercel-oidc-stub.ts` — keep this alias.
- Staff-share links are created only when the latest estimate_terms payment_status confirms the deposit; the UI and server both check stored status, not displayed amounts.
- Home status grouping uses home-reservation-stage without changing contract stages; both waiting lists carry estimate_id to history and validate stored payment evidence so confirmation clears the target.
- Telephone inputs, draft saves, company defaults and worker RPCs use formatTel for stored/display values; SMS transport alone strips separators, preserving legacy records on reads.
- Auth persistence preserves existing durable sessions during refresh; Google sets persistence before OAuth so reopening cannot downgrade stored tokens to tab-only storage.
- Durable auth writes finish before temp-session cleanup, and billing return verifies restored auth first, so redirects never drop a valid session.
- JimpickProvider owns the sole app auth subscription, waits for validated startup recovery, and cancels/clears private query caches before explicit sign-out; this avoids login flashes and duplicate sign-outs.

- Subdirectories have their own `AGENTS.md` (e.g. `src/lib/AGENTS.md` for customer intake); read it before changing files there.
- Direct selection and room scan reuse StepHero/CharacterGuide; quantity cards share a scoped quantity-selected style without changing counter or persistence logic, preventing layout and selection drift.
- Shared address selection appends provider-returned building names to the existing address string through address-label; this preserves names across intake, estimates and saved drafts without changing coordinates or detail fields.

- Deposit acknowledgement uses the owner-locked confirm_payment_receipt RPC to atomically and idempotently sync receipt sums and contract payment state; balance completion delegates to complete_estimate_payment, preventing duplicate sums, total changes or messaging side effects.
- PaymentPanel separates saved quoted deposits from confirmed receipts; review borders retain actual amounts, so editing a quote cannot invent payment. Only pendingBalanceReceipts are offered for review.
- Customer claims use stage-specific dedupe and stored totals; only owner acknowledgement confirms receipts, and payment SMS prep is read-only native-composer only.
- History opens receipt-review months by default; SMS groups use Asia/Seoul; archive deletion reuses authenticated soft-delete and refreshes only after success to preserve payments and SMS.
- Bank SMS are stored first in bank_sms_messages (deduped by event ID or text hash, never name/account/estimate), then matched via bank-sms-match into one pending deposit_records row; detection never completes payment. Forward URLs use publicUrl (preview blocks external POSTs); SMS dates parse as Asia/Seoul.
- Bank SMS inbox deletion uses the owner-scoped security-invoker hide_bank_sms RPC and list-only deleted_at filtering; retained originals and dedupe keys prevent replay without touching receipt or payment state.
- AI item images are checked by item-image-verify against the item name before createManualItem stores them, and prompts come from item-image-prompt; this prevents a mismatched picture being linked to an item ID.
- Options snapshot catalog ID, image URL and name in options JSON and render via OptionArt, keeping owner/customer/PDF art identical.
- Native sheet printing marks only the printable ancestor branch and uses normal-flow pagination until afterprint; this prevents paper-size clipping.

- Final completion and explicit sheet saves atomically persist draft revisions and current customer totals via save_edited_estimate_sheet, then commit history by ID; plannedDeposit and payment audits stay untouched.
- Sheet disposal uses room/item IDs and pointer tap timing with movement cancellation; shared rendering overlays an X without changing image sources or quantities.
- Customer sheet decoration belongs to SharePage wrappers and pointer-transparent CSS pseudo-elements, not EstimateSheet; this isolates owner/export content and preserves layout and interaction.
- External Cloudflare hosting config lives in root wrangler.jsonc (worker name gyejeokkit, nodejs_compat); nitro merges it into dist/server/wrangler.json on every build — keep it, and keep the Lovable published site live because the bank-SMS webhook and admin-key server functions only run there.
- Brand refreshes use versioned CDN pointers (separate padded maskable icon, versioned favicon) with stable manifest identity/start URL, so installs don't duplicate.

- Owner notifications come only from DB triggers with per-company dedupe keys and push via push-dispatch + public/push-sw.js; owners may change only read_at and a one-way deleted_at soft delete (dedupe kept), keeping reads apart from payment confirmation.
- Customer share-link server functions reject signed-in sessions via customer-link-guard and never count their views; the token link stays the customer credential.
- MoveDateCalendar is shared by owner and customer flows (ratio-spacer cells, equal rows; customer shell overflow: clip keeps the sticky bar visible); this keeps both identical without clipping dates.
- Customer origin entry stays single-house; additional house credentials share one intake request/estimate, token-isolated JSON and a locked revision-checked save RPC. Destination snapshots prevent stale cross-link overwrites; owner/sheet projections and origin-tagged rooms reuse existing cost calculation without duplicate destination charges.
