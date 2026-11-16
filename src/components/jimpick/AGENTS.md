# Component rules (moved from src/lib/AGENTS.md)

- Shared picker art uses a responsive square with an inset safety area and centered contain images without fit scaling or clipped overflow; this keeps wide items intact in both owner and customer three-column lists without altering source assets.
- Public intake renders the actual Step1/Step2/Step3 through CustomerFlowProvider and a field adapter, with token-scoped persistence and no company auth store; this prevents separate UI drift or authenticated company operations from public links.
- Settings derives notice-card visibility only from successfully loaded/saved company contact data; retired bank inbox navigation falls back to settings, preserving history without exposing collection tools.
- Staff sheets snapshot draft worker counts and separate-work labels and reuse selected-item repair for names/art; this avoids duplicate options and company-global image state while preserving room quantities.
- Address navigation uses TmapAddress + tmap-nav (official tmap:// route with validated lon/lat, else TMAP search) with base road/jibun address only; it fires only on user tap, never sends unit details or collects location, and offers copy/install as user-chosen fallbacks.
