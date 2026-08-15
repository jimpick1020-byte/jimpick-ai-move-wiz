-- 1) 약관 원문과 버전
CREATE TABLE public.terms_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  source text NOT NULL,
  version text NOT NULL,
  effective_at date NOT NULL,
  summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);
GRANT SELECT ON public.terms_documents TO anon;
GRANT SELECT ON public.terms_documents TO authenticated;
GRANT ALL ON public.terms_documents TO service_role;
ALTER TABLE public.terms_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY terms_docs_select_all ON public.terms_documents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY terms_docs_insert_admin ON public.terms_documents FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY terms_docs_update_admin ON public.terms_documents FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER terms_documents_updated_at BEFORE UPDATE ON public.terms_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) 견적서에 적용된 약관 (고객용 보안 링크 단위)
CREATE TABLE public.estimate_terms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimate_id text NOT NULL,
  sheet_no text,
  sheet_version integer NOT NULL DEFAULT 1,
  customer_name text NOT NULL DEFAULT '',
  move_date text,
  total integer NOT NULL DEFAULT 0,
  contact_phone text,
  terms_document_id uuid REFERENCES public.terms_documents(id),
  terms_name text NOT NULL,
  terms_version text NOT NULL,
  terms_effective_at date,
  access_token text NOT NULL UNIQUE,
  sent_at timestamptz,
  sent_msg_id text,
  viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, estimate_id, sheet_version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimate_terms TO authenticated;
GRANT ALL ON public.estimate_terms TO service_role;
ALTER TABLE public.estimate_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY estimate_terms_select_own ON public.estimate_terms FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY estimate_terms_insert_own ON public.estimate_terms FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY estimate_terms_update_own ON public.estimate_terms FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY estimate_terms_delete_own ON public.estimate_terms FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER estimate_terms_updated_at BEFORE UPDATE ON public.estimate_terms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX estimate_terms_user_idx ON public.estimate_terms (user_id, created_at DESC);

-- 3) 고객 동의 기록 (원문 스냅샷 포함, 사후 변경 불가)
CREATE TABLE public.terms_acceptances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_terms_id uuid NOT NULL REFERENCES public.estimate_terms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimate_id text NOT NULL,
  sheet_version integer NOT NULL DEFAULT 1,
  terms_name text NOT NULL,
  terms_version text NOT NULL,
  terms_effective_at date,
  terms_snapshot text NOT NULL,
  accepted boolean NOT NULL DEFAULT true,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  accept_method text NOT NULL DEFAULT 'web_checkbox',
  token_hint text,
  sent_msg_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (estimate_terms_id)
);
GRANT SELECT ON public.terms_acceptances TO authenticated;
GRANT ALL ON public.terms_acceptances TO service_role;
ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;
-- 업체·관리자는 읽기만 가능합니다. 대신 동의 처리하는 것을 막기 위해 쓰기 정책은 두지 않습니다.
CREATE POLICY terms_acceptances_select_own ON public.terms_acceptances FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX terms_acceptances_user_idx ON public.terms_acceptances (user_id, accepted_at DESC);