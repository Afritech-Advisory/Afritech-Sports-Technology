/**
 * Reads coaching notes aloud with the browser's built-in speech engine.
 * No audio files: the voice comes from the viewer's device, so it varies by device.
 */
/** English voice regions in order of preference: Kenya, then the rest of East Africa, then West and South. */
export const AFRICAN_ENGLISH = ['KE', 'TZ', 'UG', 'NG', 'GH', 'ZA'];
const COUNTRY: Record<string, string> = {
  KE: 'Kenyan', TZ: 'Tanzanian', UG: 'Ugandan', NG: 'Nigerian', GH: 'Ghanaian', ZA: 'South African',
  GB: 'British', US: 'American', AU: 'Australian', IN: 'Indian', IE: 'Irish', CA: 'Canadian',
};

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

  /** Kenyan English first, then other African English voices, then any English voice. */
  voice(): SpeechSynthesisVoice | undefined {
    const voices = speechSynthesis.getVoices();
    const region = (v: SpeechSynthesisVoice) => {
      const m = /^en[-_]([a-z]{2})/i.exec(v.lang);
      return m ? m[1].toUpperCase() : '';
    };
    // Natural or online voices sound better than the older built-in ones
    const quality = (v: SpeechSynthesisVoice) => (/natural|online|neural/i.test(v.name) ? 0 : 1);
    for (const code of AFRICAN_ENGLISH) {
      const match = voices.filter((v) => region(v) === code).sort((a, b) => quality(a) - quality(b));
      if (match.length) return match[0];
    }
    return voices.find((v) => /^en/i.test(v.lang));
  }

  /** Plain description of the voice in use, for the page. */
  describeVoice(): { label: string; african: boolean } | null {
    if (!this.supported) return null;
    const v = this.voice();
    if (!v) return null;
    const m = /^en[-_]([a-z]{2})/i.exec(v.lang);
    const code = m ? m[1].toUpperCase() : '';
    const name = v.name.replace(/^(Microsoft|Google|Apple)\s+/i, '').replace(/\s*\(.*\)\s*$/, '').replace(/\s+Online.*$/i, '');
    return {
      label: `${COUNTRY[code] ? `${COUNTRY[code]} English` : 'English'}${/english/i.test(name) ? '' : ` (${name})`}`,
      african: AFRICAN_ENGLISH.includes(code),
    };
  }

  private next(token: number): void {
    if (token !== this.token || this.index >= this.lines.length) {
      if (token === this.token) { this.speaking = false; this.onLine(null, ''); }
      return;
    }
    const i = this.index;
    const u = new SpeechSynthesisUtterance(this.lines[i]);
    const v = this.voice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-KE';
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
