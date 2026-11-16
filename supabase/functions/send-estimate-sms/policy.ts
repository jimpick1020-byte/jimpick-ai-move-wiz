export function smsRequestAllowed(input: { mode?: string; checkOnly?: boolean; isServerCall: boolean; isServiceAdmin: boolean }): boolean {
  if (input.mode === "manager_notify") return input.isServerCall || input.isServiceAdmin;
  if (input.mode === "fix_notice") return input.isServerCall || input.isServiceAdmin;
  if (input.checkOnly) return input.isServerCall || input.isServiceAdmin;
  if (input.mode && !["test", "deposit_notify"].includes(input.mode)) return false;
  return input.isServiceAdmin && !input.isServerCall;
}