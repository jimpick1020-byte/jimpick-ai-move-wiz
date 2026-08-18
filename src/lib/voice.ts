/**
 * 브라우저 음성인식(Web Speech API) 관련 확인·안내 도우미.
 *
 * 음성 해석 자체는 서버 AI(parseVoiceOrder)가 맡습니다.
 * 여기서는 "쓸 수 있는 상황인지" 미리 확인하고, 안 될 때 이유를 쉬운 말로 알려 줍니다.
 */

export interface SpeechAlternativeLike {
  transcript: string;
  /** 브라우저가 알려 주는 확신도 0~1. 안 알려 주는 브라우저는 0 입니다. */
  confidence?: number;
}
export interface SpeechResultLike {
  isFinal: boolean;
  length?: number;
  [i: number]: SpeechAlternativeLike;
}

/**
 * 후보 문장 중 가장 확신하는 것을 고릅니다.
 * (maxAlternatives 를 올려 두면 후보가 여러 개 옵니다)
 */
export function bestAlternative(r: SpeechResultLike): {
  transcript: string;
  confidence: number;
} {
  const n = Math.max(1, r.length ?? 1);
  let best = { transcript: r[0]?.transcript ?? "", confidence: r[0]?.confidence ?? 0 };
  for (let i = 1; i < n; i++) {
    const alt = r[i];
    if (!alt) continue;
    if ((alt.confidence ?? 0) > best.confidence) {
      best = { transcript: alt.transcript ?? "", confidence: alt.confidence ?? 0 };
    }
  }
  return best;
}
export interface SpeechEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechResultLike };
}
export interface SpeechErrorLike {
  error: string;
}
export interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: SpeechErrorLike) => void) | null;
  onend: (() => void) | null;
}
export type RecognitionCtor = new () => RecognitionLike;

export function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** 이 브라우저에서 음성인식을 쓸 수 있는지 */
export function isSpeechSupported(): boolean {
  return recognitionCtor() !== null;
}

/**
 * 음성인식은 보안 연결(https 또는 localhost)에서만 동작합니다.
 * 휴대폰에서 http://192.168.x.x 로 접속하면 마이크가 막히므로 미리 알려 줍니다.
 */
export function isSecureForMic(): boolean {
  if (typeof window === "undefined") return true;
  return window.isSecureContext === true;
}

/** 보안 연결이 아닐 때 보여 줄 안내문 */
export const INSECURE_MIC_MESSAGE =
  "지금 주소(http)에서는 휴대폰 마이크를 쓸 수 없습니다. 배포된 주소(https)로 접속하시거나, 컴퓨터에서 테스트해 주세요.";

/** 음성인식 오류 코드를 쉬운 한국어 안내로 */
export function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
      return "마이크 사용이 거부되었습니다. 주소창 왼쪽 자물쇠(또는 ⓘ)를 눌러 [마이크]를 '허용'으로 바꾼 뒤 다시 시도해 주세요.";
    case "service-not-allowed":
      return "이 브라우저의 음성인식 서비스를 쓸 수 없습니다. 갤럭시는 크롬, 아이폰은 사파리로 열어 주세요.";
    case "language-not-supported":
      return "이 기기에서는 한국어 음성인식을 지원하지 않습니다. 아래 '글로 담기'를 써 주세요.";
    case "no-speech":
      return "소리가 들리지 않았습니다. 마이크에 조금 더 가까이서 또박또박 말씀해 주세요.";
    case "audio-capture":
      return "마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해 주세요.";
    case "network":
      return "인터넷 연결이 불안정해 음성인식이 중단되었습니다. 연결을 확인한 뒤 다시 시도해 주세요.";
    case "aborted":
      return "음성인식이 중단되었습니다. 다시 시도해 주세요.";
    default:
      return "음성을 알아듣지 못했습니다. 조용한 곳에서 다시 말씀해 주세요.";
  }
}
