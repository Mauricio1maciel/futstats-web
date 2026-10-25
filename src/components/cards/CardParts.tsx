import Link from 'next/link';
import { setPreview } from '@/lib/preview';
import { playerHref } from '@/lib/routes';
import { hangingDetail, suspensionDetails, yellowsText } from '@/lib/cards';
import type { CardPlayer } from '@/lib/types';

export const YellowCard = () => <span className="inline-block h-3 w-2 shrink-0 rounded-xs bg-gold" aria-hidden />;
export const RedCard = () => <span className="inline-block h-3 w-2 shrink-0 rounded-xs bg-live" aria-hidden />;

// Amarelos e vermelhos de um jogador: "▮ 4  ▮ 1", ou "▮ 2 que contam · 5 no total" quando os
// amarelos zeraram (ou só parte conta)
export function CardCounts({ player }: { player: CardPlayer }) {
  const yellows = yellowsText(player);
  return (
    <span className="inline-flex shrink-0 items-center gap-2.5 text-xs font-bold tabular-nums text-ink-2">
      <span className="inline-flex items-center gap-1" aria-label={`Amarelos: ${yellows}`}>
        <YellowCard />
        <span className={yellows.length > 3 ? 'font-normal text-muted' : ''}>{yellows}</span>
      </span>
      {player.red_cards > 0 && (
        <span className="inline-flex items-center gap-1" aria-label={`${player.red_cards} vermelhos`}>
          <RedCard />
          {player.red_cards}
        </span>
      )}
    </span>
  );
}

// Motivo da suspensão, na cor do cartão: "3º amarelo" em amarelo; "cartão vermelho" e "segundo
// amarelo" (expulsão) em vermelho
export function ReasonBadge({ reason }: { reason?: string }) {
  if (!reason) return null;
  const red = /vermelho|segundo amarelo/i.test(reason);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${red ? 'bg-live/15 text-live' : 'bg-gold/15 text-gold'}`}>
      {red ? <RedCard /> : <YellowCard />}
      {reason}
    </span>
  );
}

// Nome do jogador: abre a tela dele quando tem o ID da ESPN (o mesmo do /player/stats)
export function CardPlayerName({ player, teamName, className = '' }: { player: CardPlayer; teamName?: string; className?: string }) {
  const id = player.espn_player_id;
  if (!id) return <span className={`min-w-0 truncate ${className}`}>{player.name}</span>;
  return (
    <Link
      href={playerHref(id)}
      onClick={() => setPreview('player', id, { name: player.name, team_name: teamName })}
      className={`min-w-0 truncate active:opacity-70 ${className}`}
    >
      {player.name}
    </Link>
  );
}

export const INCOMPLETE_NOTE = 'Alguns jogos estão sem os lances: a lista pode estar incompleta.';

// Suspenso: nome, motivo e, embaixo, "suspenso por 2 jogos" / "pode pegar mais jogos"
export function SuspendedItem({ player, teamName, nameClassName = 'text-sm text-ink' }: { player: CardPlayer; teamName?: string; nameClassName?: string }) {
  const details = suspensionDetails(player);
  return (
    <>
      <span className="flex items-center gap-2">
        <CardPlayerName player={player} teamName={teamName} className={`flex-1 ${nameClassName}`} />
        <ReasonBadge reason={player.reason} />
      </span>
      {details.length > 0 && <span className="mt-0.5 block text-right text-[11px] text-live/90">{details.join(' · ')}</span>}
    </>
  );
}

// Pendurados em linha ("Pendurados: A, B (pega 2 jogos se levar amarelo)"), para a prévia do jogo
export function HangingInline({ players, teamName }: { players: CardPlayer[]; teamName?: string }) {
  if (!players.length) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1 text-xs text-muted">
      <YellowCard />
      <span className="font-bold text-faint">Pendurados:</span>
      {players.map((p, index) => {
        const detail = hangingDetail(p);
        return (
          <span key={`${p.espn_player_id ?? p.name}-${index}`} className="inline-flex">
            <CardPlayerName player={p} teamName={teamName} />
            {detail && <span className="ml-1 text-gold">({detail.replace('pendurado: ', '')})</span>}
            {index < players.length - 1 ? ',' : ''}
          </span>
        );
      })}
    </p>
  );
}
