import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  EXPERIMENTS_OFF,
  getMyExperimentalFeatures,
  type ExperimentalFeatures,
} from "@/lib/experimental-features.functions";

let cached: ExperimentalFeatures | null = null;
const listeners = new Set<(value: ExperimentalFeatures) => void>();

export async function refreshExperimentalFeatures(): Promise<ExperimentalFeatures> {
  let next = EXPERIMENTS_OFF;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) next = await getMyExperimentalFeatures();
  } catch {
    next = EXPERIMENTS_OFF;
  }
  cached = next;
  listeners.forEach((listener) => listener(next));
  return next;
}

export function useExperimentalFeatures() {
  const [features, setFeatures] = useState<ExperimentalFeatures>(cached ?? EXPERIMENTS_OFF);
  const [loaded, setLoaded] = useState(cached !== null);
  useEffect(() => {
    const listener = (value: ExperimentalFeatures) => {
      setFeatures(value);
      setLoaded(true);
    };
    listeners.add(listener);
    if (cached === null) void refreshExperimentalFeatures().then(() => setLoaded(true));
    return () => listeners.delete(listener);
  }, []);
  const refresh = useCallback(() => refreshExperimentalFeatures(), []);
  return { features, loaded, refresh };
}