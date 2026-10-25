'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { getZoneColor, type LegendItem } from '@/config/leagues';
import { TeamCrest } from '@/components/ui/TeamCrest';
import { teamHref } from '@/lib/routes';
import { groupStandings, isHighlighted, type TeamRef } from '@/lib/standings';
import type { StandingRow } from '@/lib/types';
import { FormDots } from './FormDots';

const COL = 'w-7.5 shrink-0 text-center';
// A coluna "Forma" não cabe ao lado de P/J/V/SG em telas com menos de 360px
const FORM_COL = 'hidden w-12 shrink-0 justify-center xs:flex';

function HeaderRow() {
  return (
    <div className="flex items-center border-b border-card-2 py-2 text-xs text-muted">
      <span className="w-9 shrink-0 pl-2.5">#</span>
      <span className="flex-1">Equipe</span>
      <span className={COL}>P</span>
      <span className={COL}>J</span>
      <span className={COL}>V</span>
      <span className={COL}>SG</span>
      <span className={`${FORM_COL} text-center`}>Forma</span>
    </div>
  );
}

function PositionChange({ change }: { change?: number }) {
  if (!change) return null;
  const up = change > 0;
  return (
    <span
      className={`shrink-0 text-[10px] font-bold ${up ? 'text-win' : 'text-loss'}`}
      aria-label={`${up ? 'Subiu' : 'Caiu'} ${Math.abs(change)} ${Math.abs(change) === 1 ? 'posição' : 'posições'}`}
    >
      {up ? '▲' : '▼'}
      {Math.abs(change)}
    </span>
  );
}

function TeamRow({ row, highlighted, showZones }: { row: StandingRow; highlighted: boolean; showZones: boolean }) {
  const zone = showZones ? getZoneColor(row.zone) : 'transparent';
  return (
    <Link
      href={teamHref(row.team_id)}
      className={`flex items-center border-b border-card-2 py-3 text-xs active:bg-white/5 ${highlighted ? 'bg-accent/10' : ''}`}
      style={{ borderLeft: `3px solid ${zone}` }}
    >
      <span className="w-9 shrink-0 pl-2 font-bold text-muted">{row.position}</span>
      <TeamCrest uri={row.crest_url} name={row.team_name} size={18} />
      <span className="ml-2.5 flex min-w-0 flex-1 items-center gap-1.5 pr-1">
        <span className={`truncate ${highlighted ? 'font-bold text-white' : 'text-ink'}`}>{row.team_name}</span>
        {row.live && <span className="h-1.5 w-1.5 shrink-0 animate-blink rounded-full bg-live" aria-label="Jogando agora" />}
        <PositionChange change={row.position_change} />
      </span>
      <span className={`${COL} font-bold text-ink`}>{row.points}</span>
      <span className={`${COL} text-ink-2`}>{row.played}</span>
      <span className={`${COL} text-ink-2`}>{row.wins}</span>
      <span className={`${COL} text-ink-2`}>{row.goal_diff}</span>
      <span className={FORM_COL}>
        <FormDots form={row.form} />
      </span>
    </Link>
  );
}

type Props = {
  rows: StandingRow[];
  highlight?: TeamRef[];
  /** Temporada antiga vem sem zonas: sem as cores */
  showZones?: boolean;
  collapsed: Record<string, boolean>;
  onToggleGroup: (name: string) => void;
};

// Classificação: tabela única ou por grupo (recolhível), faixa da zona à esquerda e marcações ao vivo
export function StandingsTable({ rows, highlight = [], showZones = true, collapsed, onToggleGroup }: Props) {
  return (
    <div className="space-y-4">
      {groupStandings(rows).map(group => {
        const isCollapsed = !!group.name && !!collapsed[group.name];
        return (
          <section key={group.name || 'tabela'} className="overflow-hidden rounded-lg bg-card-3">
            {group.name && (
              <button
                type="button"
                onClick={() => onToggleGroup(group.name)}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between bg-card-2 px-4 py-2.5 text-left"
              >
                <span className="text-[13px] font-bold uppercase text-ink">{group.name}</span>
                {isCollapsed ? <ChevronDown size={18} className="text-muted" /> : <ChevronUp size={18} className="text-muted" />}
              </button>
            )}
            {!isCollapsed && (
              <div>
                <HeaderRow />
                {group.rows.map(row => (
                  <TeamRow key={`${row.team_id}-${row.team_name}`} row={row} highlighted={isHighlighted(row, highlight)} showZones={showZones} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function StandingsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg bg-card-3" aria-hidden>
      <HeaderRow />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-card-2 py-3 pl-3">
          <span className="h-3 w-4 animate-pulse rounded bg-line-2/70" />
          <span className="h-4.5 w-4.5 animate-pulse rounded-full bg-line-2/70" />
          <span className="h-3 flex-1 animate-pulse rounded bg-line-2/70" />
          <span className="mr-3 h-3 w-24 animate-pulse rounded bg-line-2/70" />
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: LegendItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-3 px-3 pb-6 pt-6">
      {items.map(item => (
        <li key={item.label} className="flex items-center gap-2.5 text-[13px] text-ink-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

// Botão "Ao vivo": pílula com borda vermelha e um ponto vermelho (piscando quando ligado)
export function LiveToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-live px-3.5 py-1.5 text-xs font-bold transition-colors ${
        on ? 'bg-live/15 text-white' : 'text-live'
      }`}
    >
      <span className={`h-2 w-2 rounded-full bg-live ${on ? 'animate-blink' : ''}`} />
      Ao vivo
    </button>
  );
}
