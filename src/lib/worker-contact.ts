export interface WorkerContact {
  id: string;
  name: string;
  role: string;
  phone: string;
  photo: string;
  legacy?: boolean;
  gender?: WorkerGender;
}

export type WorkerGender = "male" | "female" | "unspecified";
export const WORKER_GENDERS: WorkerGender[] = ["male", "female", "unspecified"];
export function workerGender(contact: { gender?: unknown }): WorkerGender {
  return contact.gender === "male" || contact.gender === "female" ? contact.gender : "unspecified";
}
export function groupWorkerContacts(contacts: WorkerContact[]): Record<WorkerGender, WorkerContact[]> {
  const groups: Record<WorkerGender, WorkerContact[]> = { male: [], female: [], unspecified: [] };
  for (const contact of contacts) groups[workerGender(contact)].push(contact);
  return groups;
}

export function maskedWorkerPhone(phone: string): string {
  const n = phone.replace(/\D/g, "");
  return n.length >= 10 ? `${n.slice(0, 3)}-****-${n.slice(-4)}` : "연락처 미등록";
}

export function selectedWorkerContacts(contacts: WorkerContact[], ids: string[]): WorkerContact[] {
  const selected = new Set(ids);
  return contacts.filter((c) => selected.has(c.id));
}

export function workerSmsHref(contacts: WorkerContact[], text: string, ios: boolean): string {
  const phones = [...new Set(contacts.map((c) => c.phone.replace(/\D/g, "")))];
  if (!phones.length || phones.some((n) => !/^01[016789][0-9]{7,8}$/.test(n))) {
    throw new Error("작업자 연락처를 확인해 주세요.");
  }
  return `sms:${phones.join(ios ? ";" : ",")}${ios ? "&" : "?"}body=${encodeURIComponent(text)}`;
}