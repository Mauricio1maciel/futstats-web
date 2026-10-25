import { hangingDetail, suspensionDetails, yellowsText } from './cards';

const p = (extra: object) => ({ name: 'X', yellow_cards: 2, red_cards: 0, ...extra });

describe('textos dos cartões', () => {
  it('suspenso: jogos a cumprir e vermelho direto', () => {
    expect(suspensionDetails(p({ matches_banned: 1 }))).toEqual([]);
    expect(suspensionDetails(p({ matches_banned: 2 }))).toEqual(['suspenso por 2 jogos']);
    expect(suspensionDetails(p({ matches_banned: 1, may_be_longer: true }))).toEqual(['pode pegar mais jogos']);
  });

  it('pendurado que pega mais de um jogo', () => {
    expect(hangingDetail(p({ ban_if_booked: 1 }))).toBe('');
    expect(hangingDetail(p({ ban_if_booked: 2 }))).toBe('pendurado: pega 2 jogos se levar amarelo');
  });

  it('amarelos que contam e o total, só quando diferem', () => {
    expect(yellowsText(p({ total_yellow_cards: 5 }))).toBe('2 que contam · 5 no total');
    expect(yellowsText(p({ total_yellow_cards: 2 }))).toBe('2');
    expect(yellowsText(p({}))).toBe('2');
  });
});
