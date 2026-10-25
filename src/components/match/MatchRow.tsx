'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { LiveClock } from './LiveClock';
import { formatShortDate, formatTime, getMatchDate } from '@/lib/dates';
import { getEspnMatchId, getGroupBadge, getSpecialStatusLabel, isFinishedMatch, isLiveMatch, teamDisplayName } from '@/lib/matches';
import { setMatchPreview } from '@/lib/preview';
import type { Match } from '@/lib/types';
import { Score } from './Score';

type Variant = 'home' | 'card' | 'embedded';

type Props = {
  match: Match;
  href: string;
  /** home: lista da tela inicial; card: cartão das listas da liga; embedded: dentro de um bloco (time) */
  variant?: Variant;
  /** Data curta ("18/10") embaixo do horário/placar */
  showDate?: boolean;
  /** Linha de cima do cartão ("Fase de Grupos • Grupo A • Rodada 3") */
  header?: string;
  /** Linha de baixo ("Agregado 2-1") */
  footer?: string;
  /** Selo "Fase de Grupos • Grupo A" */
  showGroupBadge?: boolean;
  /** Ao lado direito, fora do link (estrela de seguir, quando existir na web) */
  aside?: ReactNode;
};

const containerStyle: Record<Variant, string> = {
  home: 'bg-card-2',
  card: 'mx-2.5 mb-1.5 overflow-hidden rounded-lg bg-card-3',
  embedded: '',
};

// Linha de jogo: mandante (nome + escudo), centro (placar/horário) e visitante. Vencedor com * amarelo
export function MatchRow({ match, href, variant = 'card', showDate = false, header, footer, showGroupBadge = true, aside }: Props) {
  const live = isLiveMatch(match);
  const finished = isFinishedMatch(match);
  const date = getMatchDate(match);
  const special = getSpecialStatusLabel(match);
  // Durante o jogo a football-data já preenche winner com quem está ganhando: o * é só no fim
  const homeWins = finished && match.winner === 'HOME_TEAM';
  const awayWins = finished && match.winner === 'AWAY_TEAM';
  const badge = showGroupBadge ? getGroupBadge(match) : '';
  const isHome = variant === 'home';
  const crestSize = isHome ? 26 : 22;

  // O * do vencedor fica fora do texto cortado ("Fluminens…") para não sumir
  const teamName = (name: string | undefined, winner: boolean, side: 'home' | 'away') => (
    <span className="flex min-w-0 items-center">
      {winner && side === 'home' && <span className="mr-1 shrink-0 text-[13px] font-bold text-gold">*</span>}
      <span className={`truncate text-[13px] ${winner ? 'font-bold text-white' : isHome ? 'text-ink/90' : 'text-ink-2'}`}>
        {teamDisplayName(name)}
      </span>
      {winner && side === 'away' && <span className="ml-1 shrink-0 text-[13px] font-bold text-gold">*</span>}
    </span>
  );

  let center: ReactNode;
  if (live || finished) {
    center = isHome ? (
      <>
        <Score match={match} live={live} className="text-lg" />
        <span className={`mt-1 text-[10px] ${live ? 'font-bold text-live' : 'text-muted'}`}>
          {live ? <LiveClock match={match} matchId={getEspnMatchId(match)} fallback="Ao vivo" /> : 'Encerrado'}
        </span>
      </>
    ) : (
      <>
        <span className={`mb-0.5 text-[10px] ${live ? 'font-bold text-live' : 'text-muted'}`}>{live ? 'Ao Vivo' : 'Fim'}</span>
        <Score match={match} live={live} className="text-[15px]" penaltyClassName="text-[11px]" />
      </>
    );
  } else {
    center = (
      <span className={isHome ? 'text-[13px] font-semibold text-muted' : 'text-[15px] font-bold text-white'}>
        {special || formatTime(date) || '--:--'}
      </span>
    );
  }

  return (
    <div className={`relative ${containerStyle[variant]}`}>
      <Link href={href} onClick={() => setMatchPreview(match)} className="block active:bg-white/5">
        {header && <p className="border-b border-card-2 px-3 py-2.5 text-[13px] font-bold text-ink">{header}</p>}
        {badge && (
          <p className={`${isHome ? 'bg-line-2' : 'bg-card-2'} py-1 text-center text-[10px] font-bold uppercase tracking-wide text-muted`}>
            {badge}
          </p>
        )}
        <div className={`flex items-center ${isHome ? 'px-4 py-4.5' : variant === 'embedded' ? 'px-3 py-3' : 'px-4 py-3.75'}`}>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
            {teamName(match.home_team, homeWins, 'home')}
            <TeamCrest uri={match.home_logo} name={match.home_team} size={crestSize} />
          </div>
          <div className="flex min-w-18 flex-col items-center justify-center px-1.5">
            {center}
            {showDate && <span className="mt-1 text-[10px] text-muted">{formatShortDate(date)}</span>}
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <TeamCrest uri={match.away_logo} name={match.away_team} size={crestSize} />
            {teamName(match.away_team, awayWins, 'away')}
          </div>
        </div>
        {footer && <p className="-mt-2 px-3 pb-2.5 text-center text-xs text-muted">{footer}</p>}
      </Link>
      {aside && <div className="absolute inset-y-0 right-1.5 flex items-center">{aside}</div>}
    </div>
  );
}

// Esqueleto de uma linha de jogo
export function MatchRowSkeleton({ variant = 'card' }: { variant?: Variant }) {
  const isHome = variant === 'home';
  return (
    <div className={containerStyle[variant]} aria-hidden>
      <div className={`flex items-center ${isHome ? 'px-4 py-4.5' : 'px-4 py-3.75'}`}>
        <div className="flex flex-1 items-center justify-end gap-2.5">
          <span className="h-3 w-20 animate-pulse rounded bg-line-2/70" />
          <span className={`${isHome ? 'h-6.5 w-6.5' : 'h-5.5 w-5.5'} animate-pulse rounded-full bg-line-2/70`} />
        </div>
        <div className="flex min-w-18 flex-col items-center gap-1 px-1.5">
          <span className="h-5 w-10 animate-pulse rounded-md bg-line-2/70" />
          <span className="h-2.5 w-7 animate-pulse rounded bg-line-2/70" />
        </div>
        <div className="flex flex-1 items-center gap-2.5">
          <span className={`${isHome ? 'h-6.5 w-6.5' : 'h-5.5 w-5.5'} animate-pulse rounded-full bg-line-2/70`} />
          <span className="h-3 w-20 animate-pulse rounded bg-line-2/70" />
        </div>
      </div>
    </div>
  );
}

export function MatchListSkeleton({ count = 6, variant = 'card' }: { count?: number; variant?: Variant }) {
  return (
    <div className={variant === 'card' ? 'pt-2.5' : 'space-y-px'}>
      {Array.from({ length: count }, (_, i) => (
        <MatchRowSkeleton key={i} variant={variant} />
      ))}
    </div>
  );
}

const RESULT_COLORS = { V: 'bg-win', E: 'bg-draw', D: 'bg-loss' } as const;

// Bolinha V/E/D do ponto de vista do time
export function ResultBadge({ result }: { result: 'V' | 'E' | 'D' }) {
  const label = result === 'V' ? 'Vitória' : result === 'E' ? 'Empate' : 'Derrota';
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${RESULT_COLORS[result]}`}
    >
      {result}
    </span>
  );
}
