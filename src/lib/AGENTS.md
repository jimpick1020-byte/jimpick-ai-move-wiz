# Customer intake link rules

- PayApp new orders snapshot KST request date and five-year exclusive expiry; full first-approval dates and same-day pending checks preserve locks, while paid access stays separate from provider expiry. Never enable registration before same-day validity and card month-end policy are verified.

- Reminder resend previews read only company-owned rows and share the sender's message builder; opening or cancelling a preview never sends SMS or reserves usage.

- Owner selected-item removal uses an authenticated security-invoker RPC locking the company request and matching draft; it removes only room quantity/disposal JSON, never catalog rows.
- Shared picker art uses a responsive square with an inset safety area and centered contain images without fit scaling or clipped overflow; this keeps wide items intact in both owner and customer three-column lists without altering source assets.

- Customer intake house links live in one `intake_requests` row (company-scoped RLS; each token SHA-256 indexed and AES-GCM encrypted); separate draft/submission JSON and shared destination snapshots commit through locked revision-checked service-only RPCs to one preassigned estimate ID, preventing cross-house and concurrent overwrite.
- Intake customer functions look up rows only by token hash; owner-scoped request preparation supplies text and a valid customer link to the gated native SMS composer using the current input phone, without file sharing or preparation dialogs; intake and visit composer opening never invokes a provider or records sending without separate owner confirmation.
- Intake and visit previews use versioned public image pointers in leaf SSR head metadata with absolute URLs; version query parameters do not alter token lookup, keeping existing customer links valid.
- Customer catalog edits use item_icons customer_* fields and authenticated platform-role checks before privileged access; customer_only rows are excluded from the ordinary company catalog and deletion only retires customer visibility, preserving historic estimates and images.
- Intake customer images use short-lived signed Storage URLs; submitted drafts snapshot Korean names and durable image routes into customItems so existing estimate views can render them after re-login.
- History merges company-owned rows by estimate ID; final and sheet-save revisions replace older copies and atomically synchronized terms totals repair legacy amounts, while intake resubmissions preserve owner edits.
- Unconverted submitted intake drafts are retired with estimate_drafts deletion markers and cancelled intake status, never by deleting requests or touching formal estimate_terms; existing tombstone synchronization keeps device lists consistent.

- Customer intake reuses Step1/Step2/Step3 and a single house-size fourth step; the owner visit estimate uses the existing full estimate flow and shared item catalog.
- Visit-estimate schedules live on intake_requests (visit_date/visit_time/visit_status) with column-level UPDATE grants; the home calendar reads them through useIntakeRequests, avoiding a second schedule table.

# Moved from root
- New company items are auto-classified offline by keyword rules in src/lib/item-classify.ts (no AI calls); group/rooms/keywords are stored in existing item_icons (subcategory_group + metadata) to avoid schema changes.
- Photo item recognition is two-stage: a cheap low-detail detect pass, then only ambiguous boxes are cropped (jpeg-js) and verified at high detail; thresholds live in src/lib/scan-rules.ts and user corrections go to scan_feedback as prompt hints, keeping credit use low.
- Scan geometry is stored in existing room_scans result JSON and rendered in the photo's natural coordinate space; missing outlines are not replaced by boxes, shelf tiers require complete confident internal shelf lines, and crop geometry maps back using exact JPEG crop bounds to avoid drift without altering catalog IDs.
- Live camera outlines run on-device through the shared src/lib/live-vision.ts singleton (WASM pinned to the installed MediaPipe version, magic_touch via InteractiveSegmenterLegacy), loaded once after the camera is ready; this keeps detection free of AI credits and the shutter is never auto-triggered or blocked.
- Public intake renders the actual Step1/Step2/Step3 through CustomerFlowProvider and a field adapter, with token-scoped persistence and no company auth store; this prevents separate UI drift or authenticated company operations from public links.
- Payment review uses actual receipts, not claims/stored balances; locked owner RPC completes, history polls every 15s. Explicit deposit/balance registration prevents pre-confirmation misclassification.
- History retires only unconverted intake drafts through an owner-scoped locked RPC, leaving request snapshots and formal estimates or receipt-linked drafts intact; tombstones prevent device copies from reappearing.

- Request deletion uses the owner-scoped locked delete_intake_request RPC and soft markers; formal estimate/receipt-linked drafts are protected and audit snapshots are retained.
- Calendar eligibility is the estimate's own reservation stage (예약 확정 · 결제 완료) on the latest version, so every history row shown as 예약 확정 appears on its move date; confirming a deposit receipt still completes any scheduled linked visit and soft-hides the linked request (deleted_at only), so requests leave the list once a deposit is confirmed without losing records.
- Both contract-calendar readers use the shared calendar-visibility predicate (calendarReservationShown) after latest-version selection; this keeps the calendar and the estimate history from disagreeing about which reservations count.
- Destination house size is stored separately (intake form toSize, estimate toSizeTab, owner hint intakeToSize) and never copied from the origin size; missing values stay unselected and render as 미입력 so legacy records keep their origin size unchanged.
- Request and calendar visits share useVisitEstimate plus owner-locked resume/finalize RPCs; owner-start markers prevent customer resubmission from overwriting edits and completion markers preserve records while hiding finished requests.
- Manual image form recovery uses company-keyed IndexedDB for generated bytes; upload retries reuse those bytes and success requires ready storage-backed item readback.
- Intake unread state changes only on detail review; DB triggers sync linked notification reads and successful estimate deliveries, while native composer sends require explicit owner confirmation and final saved drafts retain their request IDs.
- Ladder prices recompute via ladder-fee.ts only on edits in updateDraft, so opened estimates never change.
- Terms publishing preserves same-revision tokens and retries only a verified token-unique collision; the native SMS composer uses the returned persisted token, preventing stale links without weakening company scope.
- Owner room edits go by room ID via room-manage.ts (roomsCustomized), so items never follow names.
- Two-house estimates keep the house being edited in from* fields and the other in extraOrigin, swapped only by house-workspace switchHouse (activeHouse, per-house houseSteps); Step4 shows only active-house rooms, so one estimate ID holds both houses without cross-overwrites.
