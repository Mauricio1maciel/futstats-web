import type { Match } from './types';

export type LiveClockData = Pick<Match, 'clock' | 'clock_seconds' | 'clock_at' | 'clock_running' | 'period' | 'clock_estimated'>;

// Minuto em que cada período acaba: passou dele, são os acréscimos ("45+2'")
const PERIOD_END: Record<number, number> = { 1: 45, 2: 90, 3: 105, 4: 120 };
// O relógio não passa disso além do fim do período (o site ficou muito tempo sem atualizar)
const MAX_EXTRA_MINUTES = 15;

// Minuto escrito no texto da ESPN: "35'" -> 35, "45'+2'" -> 47 (0 se não der para ler)
function minuteFromText(clock: string | undefined) {
  const m = /^\s*(\d+)'?\s*(?:\+\s*(\d+))?/.exec(clock || '');
  return m ? Number(m[1]) + Number(m[2] || 0) : 0;
}

/** text: o que mostrar; nextChangeMs: quando o minuto vira (null = não muda sozinho) */
export type LiveClockState = { text: string; nextChangeMs: number | null };

// Minuto estimado pelo horário do início (a ESPN travou o relógio): "~32'". Só no minuto, não em
// "Intervalo"/"Pênaltis"
export function getLiveClock(match: LiveClockData, now = Date.now()): LiveClockState {
  const state = countLiveClock(match, now);
  return match.clock_estimated && state.text.includes("'") ? { ...state, text: `~${state.text}` } : state;
}

// O minuto do jogo agora, contado a partir da última leitura da ESPN (clock_seconds em clock_at).
// Sem esses campos (backend antigo, ou jogo de outra lista), fica o texto da ESPN (clock)
function countLiveClock(match: LiveClockData, now: number): LiveClockState {
  const espnText = match.clock && match.clock !== 'pre' ? match.clock : '';
  const fixed = (text: string): LiveClockState => ({ text, nextChangeMs: null });
  const readAt = match.clock_at ? Date.parse(match.clock_at) : NaN;
  if (typeof match.clock_seconds !== 'number' || !Number.isFinite(readAt)) return fixed(espnText);

  if (!match.clock_running) {
    if (match.period === 5) return fixed('Pênaltis');
    if (match.period === 1) return fixed('Intervalo');
    return fixed(espnText);
  }

  const end = PERIOD_END[match.period ?? 0];
  if (!end) return fixed(espnText);

  // Nos acréscimos a ESPN para clock_seconds no fim do período (2700 com o texto "45'+1'"):
  // vale o que estiver mais adiantado, os segundos ou o minuto escrito no texto
  const readSeconds = Math.max(match.clock_seconds, minuteFromText(match.clock) * 60);
  // Relógio do aparelho atrasado (agora < clock_at): não volta para antes da leitura da ESPN
  const seconds = readSeconds + Math.max(0, now - readAt) / 1000;
  const minute = Math.min(Math.floor(seconds / 60), end + MAX_EXTRA_MINUTES);
  const text = minute > end ? `${end}+${minute - end}'` : `${minute}'`;
  if (minute >= end + MAX_EXTRA_MINUTES) return fixed(text);
  return { text, nextChangeMs: Math.max(0, ((minute + 1) * 60 - seconds) * 1000) };
}

/** Só os campos do relógio de um jogo (para guardar na tela do jogo e passar pela rota) */
export const pickClock = (m: LiveClockData | null | undefined): LiveClockData => ({
  clock: m?.clock && m.clock !== 'pre' ? m.clock : '',
  clock_seconds: m?.clock_seconds,
  clock_at: m?.clock_at,
  clock_running: m?.clock_running,
  period: m?.period,
  clock_estimated: m?.clock_estimated,
});

// A ESPN só muda o relógio de minuto em minuto, mas clock_at é renovado a cada leitura: contar a
// partir dele faria cada recarga voltar ao começo do minuto. Por isso, enquanto o relógio chega
// igual, a contagem segue da PRIMEIRA leitura em que esse valor apareceu
const firstSeen = new Map<string, { signature: string; at: string }>();
const MAX_REMEMBERED = 200;

export function anchorClock<T extends LiveClockData>(matchId: string, match: T): T {
  if (!matchId || !match.clock_at) return match;
  const signature = [match.period, match.clock_running, match.clock_seconds, match.clock, match.clock_estimated].join('|');
  const previous = firstSeen.get(matchId);
  if (previous?.signature === signature) {
    return Date.parse(previous.at) < Date.parse(match.clock_at) ? { ...match, clock_at: previous.at } : match;
  }
  firstSeen.delete(matchId);
  firstSeen.set(matchId, { signature, at: match.clock_at });
  if (firstSeen.size > MAX_REMEMBERED) firstSeen.delete(firstSeen.keys().next().value!);
  return match;
}
