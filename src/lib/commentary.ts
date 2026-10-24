// Ícone de cada lance da narração (/match/commentary), pelo type da ESPN
export type CommentaryKind = 'goal' | 'yellow' | 'red' | 'substitution' | 'shot' | 'corner' | 'foul' | 'offside' | 'var' | 'milestone' | 'other';

// Marcos do jogo (início, intervalo, fim...): linha de destaque, sem ícone. Tipo vazio também (ex: fim do jogo)
const MILESTONES = ['kickoff', 'halftime', 'start-2nd-half', 'end-regular-time', 'start-delay', 'end-delay'];
const SHOTS = ['shot-on-target', 'shot-blocked', 'shot-off-target', 'shot-hit-woodwork'];

export function commentaryKind(type: string | undefined): CommentaryKind {
  const t = String(type || '').trim().toLowerCase();
  if (!t || MILESTONES.includes(t)) return 'milestone';
  if (t.startsWith('goal') || t === 'penalty---scored') return 'goal';
  if (t === 'yellow-card') return 'yellow';
  if (t === 'red-card') return 'red';
  if (t === 'substitution') return 'substitution';
  if (SHOTS.includes(t)) return 'shot';
  if (t === 'corner-awarded') return 'corner';
  if (t === 'foul' || t === 'handball') return 'foul';
  if (t === 'offside') return 'offside';
  if (t.startsWith('var---')) return 'var';
  return 'other';
}
