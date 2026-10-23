# Customer intake link rules

- Reminder resend previews read only company-owned rows and share the sender's message builder; opening or cancelling a preview never sends SMS or reserves usage.

- Owner selected-item removal uses an authenticated security-invoker RPC locking the company request and matching draft; it removes only room quantity/disposal JSON, never catalog rows.
- Shared picker art uses a responsive square with an inset safety area and centered contain images without fit scaling or clipped overflow; this keeps wide items intact in both owner and customer three-column lists without altering source assets.

- Customer intake links live in `intake_requests` (company-scoped RLS; token stored as SHA-256 hash for lookup plus AES-GCM copy under INTAKE_TOKEN_KEY for owner re-copy); each request pre-assigns one estimate_id so repeated customer submits update the same estimate_drafts row and never duplicate.
- Intake customer functions look up rows only by token hash; owner-scoped request preparation supplies text and a valid customer link to the gated native SMS composer using the current input phone, without file sharing or preparation dialogs; intake and visit composer opening never invokes a provider or records sending without separate owner confirmation.
- Intake and visit previews use versioned public image pointers in leaf SSR head metadata with absolute URLs; version query parameters do not alter token lookup, keeping existing customer links valid.
- Customer catalog edits use item_icons customer_* fields and authenticated platform-role checks before privileged access; customer_only rows are excluded from the ordinary company catalog and deletion only retires customer visibility, preserving historic estimates and images.
- Intake customer images use short-lived signed Storage URLs; submitted drafts snapshot Korean names and durable image routes into customItems so existing estimate views can render them after re-login.
- The owner estimate history lives in device storage, so submitted intake drafts are pulled from estimate_drafts via listIntakeDrafts and merged by estimate id (replaced only when intakeSubmittedAt changes); this keeps one card per request across devices and re-login.
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
- Calendar eligibility requires latest estimate payment state plus a confirmed owner-reviewed deposit receipt; payment triggers permanently complete only the company/estimate-linked visit with visit_completed_at.
- Both contract-calendar readers use the shared calendar-deposit predicate after latest-version selection; this prevents calendar surfaces disagreeing about unconfirmed receipts or refunds.
