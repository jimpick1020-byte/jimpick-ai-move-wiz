// 클릭 사운드 + 진동 피드백
let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function tap(kind: "click" | "soft" | "success" = "click") {
  try {
    const a = audio();
    if (a) {
      const osc = a.createOscillator();
      const gain = a.createGain();
      const now = a.currentTime;
      const freq = kind === "success" ? 880 : kind === "soft" ? 520 : 660;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.05);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(kind === "soft" ? 0.05 : 0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(gain).connect(a.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch {}
  try {
    navigator.vibrate?.(kind === "success" ? [12, 40, 18] : kind === "soft" ? 8 : 14);
  } catch {}
}
