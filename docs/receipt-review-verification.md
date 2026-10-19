# Receipt review verification

## Root cause
- The previous review predicate excluded short balance receipts unless the total was covered, and suppressed pending receipts for some stored payment states.
- No existing 950,000 KRW receipt was found during the database search. The exact customer record therefore remains unidentified; no existing record was corrected or reset.

## Behavior
- Positive pending_review receipts share one review predicate for the history border, sum, individual payer listing and detail confirmation button.
- Registration never automatically confirms, even for matching names.
- Confirmation locks one company-owned receipt and updates only status, confirmed_at and confirmed_by. It does not update estimate amounts, invoke SMS, create notifications or complete a linked visit.
- Existing full balance completion remains a separate operation.

## Authenticated browser verification
- Synthetic estimate total: 2,000,000 KRW; pending receipt: 950,000 KRW.
- History showed the requested text and 4px rgb(255, 138, 0) border; details showed payer, amount and time.
- Confirmation removed the review indicator, including after refresh. Confirmation time and reviewer persisted.
- A second 950,000 KRW receipt verified individual payer display and repeat confirmation idempotency.
- Intercepted Aligo/send-estimate-sms/native-sms attempts: zero. Receipt notification fields remained null.
- Existing deposit_records, estimate_terms, estimate_deliveries, sms_usage_events, move_reminders and intake_requests remained byte-equivalent outside the synthetic estimate.
- No browser runtime errors. Latest preview build log: build OK. 21 receipt/calendar/cash tests passed.
- Only explicitly identified synthetic rows were cleaned up after verification.

## Limits
- The reported real customer's 950,000 KRW receipt was not found; the fix was verified with isolated synthetic data, not that unidentified customer's record.