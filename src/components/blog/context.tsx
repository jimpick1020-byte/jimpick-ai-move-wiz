/*
 * AI 부동산 블로그 — 앱 상태 컨텍스트
 * 데이터는 localStorage 에 저장합니다 (사용자별 매물 보관).
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  loadRecords,
  upsertRecord,
  deleteRecord as removeRecord,
  newId,
  EMPTY_INFO,
  DEFAULT_STYLE,
  DEFAULT_LENGTH,
  cloneAsDraft,
  type PropertyRecord,
  type TransactionType,
} from "./data";

export type Screen =
  | "home"
  | "editor"
  | "drafts"
  | "done"
  | "blogs"
  | "settings"
  | "subscription";

export type EditorStep = "edit" | "preview" | "complete";

interface BlogContextValue {
  screen: Screen;
  go: (s: Screen) => void;
  records: PropertyRecord[];
  refresh: () => void;
  deleteRecord: (id: string) => void;

  current: PropertyRecord | null;
  editorStep: EditorStep;
  setEditorStep: (s: EditorStep) => void;

  startNew: () => void;
  openRecord: (id: string) => void;
  copyRecord: (id: string) => void;
  patch: (partial: Partial<PropertyRecord>) => void;
  save: () => void;
}

const BlogContext = createContext<BlogContextValue | null>(null);

export function useBlog(): BlogContextValue {
  const ctx = useContext(BlogContext);
  if (!ctx) throw new Error("useBlog must be used within BlogProvider");
  return ctx;
}

export function emptyRecord(): PropertyRecord {
  const now = Date.now();
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    status: "draft",
    transactionType: "전세" as TransactionType,
    info: { ...EMPTY_INFO },
    features: [],
    moveInMode: "",
    photos: [],
    coverPhotoId: null,
    style: DEFAULT_STYLE,
    length: DEFAULT_LENGTH,
    analysis: null,
    blog: null,
    selectedTitleIndex: 0,
  };
}

export function BlogProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>("home");
  const [records, setRecords] = useState<PropertyRecord[]>(() => loadRecords());
  const [current, setCurrent] = useState<PropertyRecord | null>(null);
  const [editorStep, setEditorStep] = useState<EditorStep>("edit");

  const refresh = useCallback(() => setRecords(loadRecords()), []);
  const go = useCallback((s: Screen) => setScreen(s), []);

  const startNew = useCallback(() => {
    setCurrent(emptyRecord());
    setEditorStep("edit");
    setScreen("editor");
  }, []);

  const openRecord = useCallback((id: string) => {
    const rec = loadRecords().find((r) => r.id === id);
    if (!rec) return;
    setCurrent(rec);
    setEditorStep(rec.status === "done" ? "complete" : rec.blog ? "preview" : "edit");
    setScreen("editor");
  }, []);

  const copyRecord = useCallback((id: string) => {
    const rec = loadRecords().find((r) => r.id === id);
    if (!rec) return;
    const draft = cloneAsDraft(rec);
    setCurrent(draft);
    setEditorStep("edit");
    setScreen("editor");
  }, []);

  const patch = useCallback((partial: Partial<PropertyRecord>) => {
    setCurrent((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial, updatedAt: Date.now() };
      const all = upsertRecord(next);
      setRecords(all);
      return next;
    });
  }, []);

  const save = useCallback(() => {
    setCurrent((prev) => {
      if (!prev) return prev;
      const all = upsertRecord(prev);
      setRecords(all);
      return prev;
    });
  }, []);

  const deleteRecord = useCallback((id: string) => {
    setRecords(removeRecord(id));
  }, []);

  return (
    <BlogContext.Provider
      value={{
        screen,
        go,
        records,
        refresh,
        deleteRecord,
        current,
        editorStep,
        setEditorStep,
        startNew,
        openRecord,
        copyRecord,
        patch,
        save,
      }}
    >
      {children}
    </BlogContext.Provider>
  );
}
