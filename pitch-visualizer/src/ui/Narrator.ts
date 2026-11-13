/**
 * Reads coaching notes aloud with the browser's built-in speech engine.
 * No audio files: the voice comes from the viewer's device, so it varies by device.
 */
export class Narrator {
  readonly supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  enabled = true;
  private lines: string[] = [];
  private index = 0;
  private speaking = false;
  private token = 0;

  constructor(private readonly onLine: (index: number | null, text: string) => void) {}

  /** New sequence: queue its title and notes, starting from the top. */
  load(title: string, notes: string[]): void {
    this.stop();
    this.lines = [title, ...notes];
    this.index = 0;
  }

  /** Start or resume. `fromTop` restarts the notes when playback restarts. */
  play(fromTop: boolean): void {
    if (!this.supported || !this.enabled) return;
    if (fromTop || this.index >= this.lines.length) this.index = 0;
    if (!this.speaking) this.next(++this.token);
  }

  /** Stop speaking and remember where we were. */
  stop(): void {
    this.token++;
    if (this.supported && (this.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
    this.speaking = false;
    this.onLine(null, '');
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stop();
  }

  private voice(): SpeechSynthesisVoice | undefined {
    const voices = speechSynthesis.getVoices();
    return voices.find((v) => /^en[-_](KE|NG|ZA|GB)/i.test(v.lang))
      ?? voices.find((v) => /^en/i.test(v.lang));
  }

  private next(token: number): void {
    if (token !== this.token || this.index >= this.lines.length) {
      if (token === this.token) { this.speaking = false; this.onLine(null, ''); }
      return;
    }
    const i = this.index;
    const u = new SpeechSynthesisUtterance(this.lines[i]);
    const v = this.voice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
    u.rate = 0.98;
    const done = () => {
      if (token !== this.token) return;
      this.index = i + 1;
      // A short gap between notes so each one lands
      setTimeout(() => this.next(token), 450);
    };
    u.onend = done;
    u.onerror = (e) => {
      if (token !== this.token) return;
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      this.speaking = false;
      this.onLine(null, '');
    };
    this.speaking = true;
    // Index 0 is the sequence title; notes are 1..n
    this.onLine(i === 0 ? null : i - 1, this.lines[i]);
    try {
      speechSynthesis.speak(u);
    } catch {
      this.speaking = false;
      this.onLine(null, '');
    }
  }
}
