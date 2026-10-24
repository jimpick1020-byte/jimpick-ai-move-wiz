import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Owner-scoped read-only signal; never parses SMS, links receipts or confirms payment. */
export function usePaymentUpdates(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let busy = false;
    let previous: string | undefined;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!alive || !user.user) return;
        const { data, error } = await supabase.from("deposit_records")
          .select("id,updated_at").eq("user_id", user.user.id)
          .order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(1);
        if (!alive || error) return;
        const signature = JSON.stringify(data ?? []);
        if (signature !== previous) {
          previous = signature;
          window.dispatchEvent(new Event("jimpick:payment-updated"));
        }
      } finally { busy = false; }
    };
    const refresh = () => { void check().catch(() => {}); };
    refresh();
    const timer = window.setInterval(refresh, 2000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled]);
}