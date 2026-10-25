import type { CardPlayer } from './types';

// Textos dos cartões (/team/cards e prévia do jogo). A regra de cada competição vem pronta em
// rule: aqui só os detalhes de cada jogador

/** Suspenso: "suspenso por 2 jogos" e "pode pegar mais jogos" (vermelho direto) */
export function suspensionDetails(player: CardPlayer): string[] {
  const parts: string[] = [];
  if ((player.matches_banned ?? 0) > 1) parts.push(`suspenso por ${player.matches_banned} jogos`);
  if (player.may_be_longer) parts.push('pode pegar mais jogos');
  return parts;
}

/** Pendurado que pega mais de 1 jogo se levar o próximo amarelo (Premier League) */
export function hangingDetail(player: CardPlayer) {
  const ban = player.ban_if_booked ?? 0;
  return ban > 1 ? `pendurado: pega ${ban} jogos se levar amarelo` : '';
}

/** Amarelos que contam e o total, quando diferem: "2 que contam · 5 no total" */
export function yellowsText(player: CardPlayer) {
  const total = player.total_yellow_cards;
  if (total == null || total === player.yellow_cards) return String(player.yellow_cards);
  return `${player.yellow_cards} que contam · ${total} no total`;
}
