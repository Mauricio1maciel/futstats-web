import { teamInitials } from './teamInitials';

describe('iniciais do escudo genérico', () => {
  it('duas primeiras palavras que importam', () => {
    expect(teamInitials('Guarany de Bagé')).toBe('GB');
    expect(teamInitials('Operário MS')).toBe('OM');
    expect(teamInitials('EC Vitória')).toBe('VI');
    expect(teamInitials('Sport Club do Recife')).toBe('SC');
    expect(teamInitials('Grêmio FBPA')).toBe('GF');
    expect(teamInitials('São Paulo FC')).toBe('SP');
  });
  it('uma palavra: as duas primeiras letras; vazio: nada', () => {
    expect(teamInitials('Bahia')).toBe('BA');
    expect(teamInitials('FC')).toBe('');
    expect(teamInitials('')).toBe('');
    expect(teamInitials(undefined)).toBe('');
  });
});
