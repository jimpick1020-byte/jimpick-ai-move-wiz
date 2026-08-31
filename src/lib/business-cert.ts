// 사업자등록증 파일 처리 (비공개 Storage 버킷 "business-docs").
//
// - 파일 경로는 항상 "<user_id>/cert_<시각>.<확장자>" → RLS 로 본인만 접근.
// - 공개 URL 을 만들지 않고, 볼 때만 짧게 유효한 서명 URL 을 발급합니다.
// - JPG / PNG / PDF, 10MB 이하만 허용(버킷에서도 한 번 더 막습니다).
import { supabase } from "@/integrations/supabase/client";

export const CERT_BUCKET = "business-docs";
export const CERT_MAX_BYTES = 10 * 1024 * 1024; // 10MB
export const CERT_ACCEPT = ["image/jpeg", "image/png", "application/pdf"] as const;

function extFor(file: File): string {
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  const dot = file.name.lastIndexOf(".");
  return dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "bin";
}

/** 업로드 전에 형식·크기를 검사합니다(한글 사유 반환) */
export function validateCertFile(file: File): string | null {
  if (!CERT_ACCEPT.includes(file.type as (typeof CERT_ACCEPT)[number])) {
    return "JPG, PNG, PDF 파일만 올릴 수 있습니다.";
  }
  if (file.size > CERT_MAX_BYTES) {
    return "파일이 너무 큽니다. 10MB 이하로 올려 주세요.";
  }
  return null;
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export interface CertUploadResult {
  ok: boolean;
  /** 저장된 object path (profiles.cert_path 에 기록) */
  path?: string;
  error?: string;
}

/**
 * 사업자등록증을 올립니다. 성공하면 새 object path 를 돌려줍니다.
 * 이전 파일(oldPath)이 있으면 새로 올린 뒤 삭제해 교체합니다.
 */
export async function uploadCert(file: File, oldPath?: string | null): Promise<CertUploadResult> {
  const invalid = validateCertFile(file);
  if (invalid) return { ok: false, error: invalid };

  const uid = await currentUserId();
  if (!uid) return { ok: false, error: "로그인이 필요합니다. 다시 로그인해 주세요." };

  const path = `${uid}/cert_${Date.now()}.${extFor(file)}`;
  const { error } = await supabase.storage.from(CERT_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return { ok: false, error: error.message };

  // 새 파일이 올라간 뒤에만 이전 파일을 정리합니다(내 폴더의 파일만).
  if (oldPath && oldPath !== path && oldPath.startsWith(`${uid}/`)) {
    await supabase.storage.from(CERT_BUCKET).remove([oldPath]).catch(() => undefined);
  }
  return { ok: true, path };
}

/** 사업자등록증을 잠깐 볼 수 있는 서명 URL 을 만듭니다(기본 60초) */
export async function certSignedUrl(path: string, expiresInSec = 60): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(CERT_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** 사업자등록증 파일을 삭제합니다(본인 폴더의 파일만) */
export async function removeCert(path: string): Promise<{ ok: boolean; error?: string }> {
  if (!path) return { ok: true };
  const uid = await currentUserId();
  if (!uid || !path.startsWith(`${uid}/`)) {
    return { ok: false, error: "본인 파일만 삭제할 수 있습니다." };
  }
  const { error } = await supabase.storage.from(CERT_BUCKET).remove([path]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 사업자등록번호를 000-00-00000 형식으로 표시(숫자 10자리일 때만) */
export function formatBusinessNumber(raw: string): string {
  const d = (raw || "").replace(/[^0-9]/g, "").slice(0, 10);
  if (d.length !== 10) return raw ?? "";
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** 숫자 10자리인지 검사 */
export function isValidBusinessNumber(raw: string): boolean {
  return (raw || "").replace(/[^0-9]/g, "").length === 10;
}
