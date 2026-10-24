import { commentaryKind } from './commentary';

describe('ícone do lance a lance', () => {
  it('gols', () => {
    expect(['goal', 'goal---header', 'goal---volley', 'penalty---scored'].map(commentaryKind)).toEqual(['goal', 'goal', 'goal', 'goal']);
  });
  it('cartões, substituição e jogadas', () => {
    expect(commentaryKind('yellow-card')).toBe('yellow');
    expect(commentaryKind('red-card')).toBe('red');
    expect(commentaryKind('substitution')).toBe('substitution');
    expect(['shot-on-target', 'shot-blocked', 'shot-off-target', 'shot-hit-woodwork'].map(commentaryKind)).toEqual(['shot', 'shot', 'shot', 'shot']);
    expect(commentaryKind('corner-awarded')).toBe('corner');
    expect(commentaryKind('foul')).toBe('foul');
    expect(commentaryKind('handball')).toBe('foul');
    expect(commentaryKind('offside')).toBe('offside');
    expect(commentaryKind('var---referee-decision-cancelled')).toBe('var');
  });
  it('marcos do jogo e tipo vazio viram linha de destaque', () => {
    for (const t of ['kickoff', 'halftime', 'start-2nd-half', 'end-regular-time', 'start-delay', 'end-delay', '', undefined]) {
      expect(commentaryKind(t)).toBe('milestone');
    }
  });
  it('tipo desconhecido: sem ícone, linha normal', () => {
    expect(commentaryKind('penalty---missed')).toBe('other');
  });
});
