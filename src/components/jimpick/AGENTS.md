# Component rules (moved from src/lib/AGENTS.md)

- Shared picker art uses a responsive square with an inset safety area and centered contain images without fit scaling or clipped overflow; this keeps wide items intact in both owner and customer three-column lists without altering source assets.
- Public intake renders the actual Step1/Step2/Step3 through CustomerFlowProvider and a field adapter, with token-scoped persistence and no company auth store; this prevents separate UI drift or authenticated company operations from public links.
- Settings opens the existing bank SMS inbox; manual paste reuses authenticated ingestion and read-only refresh never rotates forwarding credentials, preventing duplicate payment paths or silent key replacement.
