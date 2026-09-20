/**
 * 기기 안에서 도는 물체 분할(Instance Segmentation) 결과 형식.
 *
 * 가짜 마스크는 만들지 않습니다.
 *  - polygon 이 있으면 실제 물체 외곽을 따라 그립니다.
 *  - polygon 이 없으면(모델 파일 없음·실패) 네모 상자 + "정밀 외곽선 처리 중" 으로 표시합니다.
 */

export interface SegBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SegInstance {
  /** 모델이 준 영문 분류명 */
  rawLabel: string;
  confidence: number;
  /** 0~1 정규화 좌표 */
  box: SegBox;
  /** 실제 물체 외곽 좌표 (0~1). 비어 있으면 외곽선 없음 */
  polygon: { x: number; y: number }[];
}

export type SegStatus =
  | "ready" // 모델 파일 있음 + 실행 준비됨
  | "model_missing" // jimpick-furniture-seg.onnx 가 아직 없음
  | "unsupported" // 브라우저에서 실행 불가
  | "error";

export interface SegRunResult {
  status: SegStatus;
  /** 실제 실행 방식 */
  backend?: "webgpu" | "wasm";
  instances: SegInstance[];
  /** 실패 사유 (그대로 화면에 보여 줍니다) */
  message?: string;
  /** 계산에 걸린 시간(ms) */
  elapsedMs?: number;
}

/** 모델 파일 위치 — 이 파일만 교체하면 전용 모델이 동작합니다 */
export const SEG_MODEL_URL = "/models/jimpick-furniture-seg.onnx";

/** 분할 모델 파일이 없을 때 사장님·관리자에게 보여 줄 문구 */
export const SEG_MODEL_MISSING_TEXT = "짐픽 전용 분할 모델 파일이 필요합니다.";
