# Customer intake link rules

- Customer intake links live in `intake_requests` (company-scoped RLS; token stored as SHA-256 hash for lookup plus AES-GCM copy under INTAKE_TOKEN_KEY for owner re-copy); each request pre-assigns one estimate_id so repeated customer submits update the same estimate_drafts row and never duplicate.
- Intake customer functions in `intake.functions.ts` are public and must look up rows only by token hash; intake SMS reuses `sendViaAligo` with the fixed admin sender and logs to estimate_deliveries (delivery_method intake_link).
- Intake link item cards are hidden per company through `removed` in profiles.intake_item_settings (base and company items alike); item_icons rows and stored images are never deleted, so past estimates keep their pictures.
- The owner estimate history lives in device storage, so submitted intake drafts are pulled from estimate_drafts via listIntakeDrafts and merged by estimate id (replaced only when intakeSubmittedAt changes); this keeps one card per request across devices and re-login.
