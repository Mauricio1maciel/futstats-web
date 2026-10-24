import Link from 'next/link';
import { setPreview } from '@/lib/preview';
import { playerHref } from '@/lib/routes';
import type { CardPlayer } from '@/lib/types';

export const YellowCard = () => <span className="inline-block h-3 w-2 shrink-0 rounded-xs bg-gold" aria-hidden />;
export const RedCard = () => <span className="inline-block h-3 w-2 shrink-0 rounded-xs bg-live" aria-hidden />;

// Amarelos e vermelhos de um jogador: "▮ 4  ▮ 1"
export function CardCounts({ player }: { player: CardPlayer }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2.5 text-xs font-bold tabular-nums text-ink-2">
      <span className="inline-flex items-center gap-1" aria-label={`${player.yellow_cards} amarelos`}>
        <YellowCard />
        {player.yellow_cards}
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

// Motivo da suspensão, na cor do cartão: "3º amarelo", "cartão vermelho"
export function ReasonBadge({ reason }: { reason?: string }) {
  if (!reason) return null;
  const red = /vermelho/i.test(reason);
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
