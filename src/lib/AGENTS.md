# Customer intake link rules

- Customer intake links live in `intake_requests` (company-scoped RLS; token stored as SHA-256 hash for lookup plus AES-GCM copy under INTAKE_TOKEN_KEY for owner re-copy); each request pre-assigns one estimate_id so repeated customer submits update the same estimate_drafts row and never duplicate.
- Intake customer functions in `intake.functions.ts` are public and must look up rows only by token hash; intake SMS reuses `sendViaAligo` with the fixed admin sender and logs to estimate_deliveries (delivery_method intake_link).
- Customer catalog edits use item_icons customer_* fields and authenticated platform-role checks before privileged access; customer_only rows are excluded from the ordinary company catalog and deletion only retires customer visibility, preserving historic estimates and images.
- Intake customer images use short-lived signed Storage URLs; submitted drafts snapshot Korean names and durable image routes into customItems so existing estimate views can render them after re-login.
- The owner estimate history lives in device storage, so submitted intake drafts are pulled from estimate_drafts via listIntakeDrafts and merged by estimate id (replaced only when intakeSubmittedAt changes); this keeps one card per request across devices and re-login.
- Unconverted submitted intake drafts are retired with estimate_drafts deletion markers and cancelled intake status, never by deleting requests or touching formal estimate_terms; existing tombstone synchronization keeps device lists consistent.

- Customer intake Step6 uses the same BROWSE_ITEMS catalog (filtered to 가구/가전/주방) plus item_icons customer rows via CustomerFlow.catalog/hidden; never reintroduce a separate customer base list, so IDs/images stay identical to the owner flow.
- Visit-estimate schedules live on intake_requests (visit_date/visit_time/visit_status) with column-level UPDATE grants; the home calendar reads them through useIntakeRequests, avoiding a second schedule table.
