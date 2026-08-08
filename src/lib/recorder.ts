/**
 * 브라우저 마이크 → 완전한 WAV 파일(base64) 녹음기.
 * 서버 AI 음성인식(transcribeAudio)에 그대로 보낼 수 있습니다.
 */
export class WavRecorder {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private rate = 16000;

  get recording() {
    return this.node !== null;
  }

  async start() {
    if (this.node) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.rate = this.ctx.sampleRate;
    this.chunks = [];
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    this.node.onaudioprocess = (e) => {
      this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    this.source.connect(this.node);
    this.node.connect(this.ctx.destination);
  }

  /** 지금까지 녹음된 소리를 WAV base64 로 뽑고 버퍼를 비웁니다 (녹음은 계속) */
  snapshot(): string | null {
    if (!this.chunks.length) return null;
    const chunks = this.chunks;
    this.chunks = [];
    return encodeWavBase64(chunks, this.rate);
  }

  /** 녹음을 끝내고 WAV base64 를 돌려줍니다 */
  async stop(): Promise<string | null> {
    const out = this.chunks.length ? encodeWavBase64(this.chunks, this.rate) : null;
    this.chunks = [];
    try {
      this.node?.disconnect();
      this.source?.disconnect();
      this.stream?.getTracks().forEach((t) => t.stop());
      await this.ctx?.close();
    } catch {
      /* 무시 */
    }
    this.node = null;
    this.source = null;
    this.stream = null;
    this.ctx = null;
    return out;
  }
}

/** Float32 PCM → 16kHz 16bit mono WAV → base64 */
function encodeWavBase64(chunks: Float32Array[], sampleRate: number): string {
  let total = 0;
  for (const c of chunks) total += c.length;
  const flat = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    flat.set(c, o);
    o += c.length;
  }

  // 16kHz 로 다운샘플 (업로드 용량 절감, 인식률 동일)
  const target = 16000;
  const ratio = sampleRate / target;
  const outLen = ratio > 1 ? Math.floor(flat.length / ratio) : flat.length;
  const pcm = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = ratio > 1 ? flat[Math.floor(i * ratio)] : flat[i];
    const v = Math.max(-1, Math.min(1, s || 0));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }

  const rate = ratio > 1 ? target : sampleRate;
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true);

  const bytes = new Uint8Array(buffer);
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(bin);
}
