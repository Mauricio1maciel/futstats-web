'use client';

import { memo, useEffect, useState } from 'react';
import { anchorClock, getLiveClock, type LiveClockData } from '@/lib/liveClock';

type Props = {
  match: LiveClockData;
  /** ID do jogo: com ele, recargas com o relógio igual não voltam a contagem (ver anchorClock) */
  matchId?: string;
  className?: string;
  /** Sem minuto nenhum para mostrar (ex: "Ao vivo") */
  fallback?: string;
};

// Minuto do jogo ao vivo que anda sozinho entre uma atualização e outra. Redesenha só quando o
// minuto vira (um setTimeout até a próxima virada), não a cada segundo em cada card
function LiveClockView({ match, matchId = '', className, fallback = '' }: Props) {
  const [, setTick] = useState(0);
  const { text, nextChangeMs } = getLiveClock(anchorClock(matchId, match));

  // Sem lista de dependências de propósito: roda de novo a cada desenho (virada de minuto ou dados
  // novos do jogo), e a limpeza cancela o timeout anterior
  useEffect(() => {
    if (nextChangeMs == null) return;
    const timer = setTimeout(() => setTick(n => n + 1), nextChangeMs + 50);
    return () => clearTimeout(timer);
  });

  const shown = text || fallback;
  return shown ? <span className={className}>{shown}</span> : null;
}

const sameClock = (a: Props, b: Props) =>
  a.className === b.className &&
  a.matchId === b.matchId &&
  a.fallback === b.fallback &&
  a.match.clock === b.match.clock &&
  a.match.clock_seconds === b.match.clock_seconds &&
  a.match.clock_at === b.match.clock_at &&
  a.match.clock_running === b.match.clock_running &&
  a.match.period === b.match.period &&
  a.match.clock_estimated === b.match.clock_estimated;

export const LiveClock = memo(LiveClockView, sameClock);
