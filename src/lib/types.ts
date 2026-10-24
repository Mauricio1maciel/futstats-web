// Formatos das respostas da API (veja docs/API.md). Tudo vem em snake_case

type Id = number | string;

/** Jogo de /matches, /team/matches, /h2h e (com outros nomes) de /matches/live */
export type Match = {
  match_id?: Id;
  /** ID da ESPN. "0" enquanto o jogo não tem vínculo com a ESPN */
  id_event?: string;
  league?: string;
  league_name?: string;
  league_logo?: string;
  season?: string;
  round?: Id;
  stage?: string;
  group_name?: string;
  api_home_team_id?: Id;
  api_away_team_id?: Id;
  espn_home_team_id?: Id;
  espn_away_team_id?: Id;
  home_team?: string;
  away_team?: string;
  home_logo?: string;
  away_logo?: string;
  home_score?: Id;
  away_score?: Id;
  /** Só existem quando houve disputa de pênaltis */
  home_penalty?: Id | null;
  away_penalty?: Id | null;
  /** /matches: "2026-10-11 21:30:00" (UTC) */
  date_event?: string;
  /** /matches/live e /match/history */
  match_date?: string;
  /** FINISHED, TIMED, SCHEDULED, IN_PLAY, PAUSED, in, post... */
  status?: string;
  /** /matches/live: pre, in, post */
  state?: string;
  /** HOME_TEAM, AWAY_TEAM, DRAW ou vazio */
  winner?: string;
  /** Minuto do jogo (/matches/live), o texto da ESPN: "35'" */
  clock?: string;
  /** /matches/live: segundos de jogo quando a ESPN foi lida (2100 = 35 min) */
  clock_seconds?: number;
  /** /matches/live: quando a ESPN foi lida, em UTC ("2026-10-23T23:06:56Z"). Sem ele, vale só o clock */
  clock_at?: string;
  /** /matches/live: false no intervalo, nos pênaltis e com o jogo parado */
  clock_running?: boolean;
  /** /matches/live: 1 e 2 = tempos; 3 e 4 = prorrogação; 5 = pênaltis */
  period?: number;
  /** Confronto encerrado empatado e sem decisão conhecida (calculado no app) */
  tie_undecided?: boolean;
  /** Fase do cadastro de onde o jogo veio (calculado na tela da liga) */
  _phase?: string;
};

export type StandingRow = {
  position: number;
  group_name: string;
  team_id: Id;
  team_name: string;
  crest_url: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  zone: string;
  season: string;
  /** Últimos 5 resultados, do mais antigo para o mais recente: "VVEDV" */
  form?: string;
  /** Só na classificação ao vivo: o time está jogando agora */
  live?: boolean;
  /** Só na classificação ao vivo: posições ganhas (negativo = perdidas) */
  position_change?: number;
};

export type HistoryMatch = Match & {
  espn_match_id?: string;
};

export type LineupPlayer = {
  espn_team_id: Id;
  espn_player_id?: Id;
  player_name: string;
  jersey?: string;
  position?: string;
  is_starter: boolean;
  formation?: string;
  headshot_url?: string;
};

export type MatchEvent = {
  minute: string;
  event_type: string;
  espn_team_id: Id;
  player_name: string;
  details?: string;
};

export type MatchStat = {
  key: string;
  label: string;
  home: number | string;
  away: number | string;
  unit?: string;
};

export type MatchHistory = {
  match: HistoryMatch | null;
  lineups: LineupPlayer[];
  events: MatchEvent[];
  statistics: MatchStat[];
};

export type H2HSummary = {
  played: number;
  team1_wins: number;
  draws: number;
  team2_wins: number;
  team1_goals: number;
  team2_goals: number;
};

export type H2H = { team1: Id; team2: Id; summary: H2HSummary; matches: Match[] };

export type Team = {
  id?: Id;
  api_id: Id;
  name: string;
  short?: string;
  tla?: string;
  league?: string;
  stadium?: string;
  crest_url?: string;
};

export type Player = {
  id: Id;
  api_id?: Id;
  name: string;
  short_name?: string;
  position?: string;
  jersey_number?: Id;
  /** "1997-06-20" ou "1997-06-20T07:00Z" */
  date_of_birth?: string;
  nationality?: string;
  team_id?: Id;
  team_name?: string;
  headshot_url?: string;
  league?: string;
};

export type LeagueStatsPlayer = {
  rank: Id;
  player_id: Id;
  name: string;
  team: string;
  team_logo?: string;
  photo?: string;
  value: Id;
};

export type LeagueStats = { top_scorers: LeagueStatsPlayer[]; top_assists: LeagueStatsPlayer[] };

export type SearchLeague = { code: string; name: string; logo_url?: string; season?: string };

export type SearchResult = { leagues: SearchLeague[]; teams: Team[]; players: Player[] };

export type CalendarDay = { date: string; count: number };

/** Time resumido das rotas de estatísticas */
export type TeamRef = { id: Id; name: string; crest_url?: string };

export type PlayerTotals = {
  appearances: number;
  starts: number;
  /** Aproximado: 90 por jogo (120 com prorrogação), menos o tempo fora */
  minutes: number;
  goals: number;
  /** Gols de pênalti (já contados em goals) */
  penalties: number;
  own_goals: number;
  /** Passes para gol (ausente em versões antigas da API) */
  assists?: number;
  yellow_cards: number;
  red_cards: number;
};

export type PlayerCompetitionStats = PlayerTotals & { league: string; league_name: string; season: string; team: TeamRef };

export type PlayerMatchLine = {
  espn_match_id: Id;
  league: string;
  season?: string;
  date: string;
  team: TeamRef;
  opponent: TeamRef;
  home: boolean;
  goals_for: number;
  goals_against: number;
  /** V, E ou D (pênaltis contam como E) */
  result: 'V' | 'E' | 'D' | string;
  started: boolean;
  minutes: number;
  goals: number;
  penalties: number;
  own_goals: number;
  assists?: number;
  yellow_cards: number;
  red_cards: number;
  /** Minuto em que entrou/saiu ("62'") */
  subbed_in?: string;
  subbed_out?: string;
};

/** /player/stats */
export type PlayerStats = {
  player_id: Id;
  current: PlayerTotals;
  competitions: PlayerCompetitionStats[];
  last_matches: PlayerMatchLine[];
};

export type RecordSplit = { played: number; wins: number; draws: number; losses: number; goals_for: number; goals_against: number };

export type MatchRef = {
  match_id: Id;
  espn_match_id: string;
  date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
};

export type TeamAverages = {
  matches: number;
  possession: number;
  shots: number;
  shots_on_target: number;
  corners: number;
  fouls: number;
  yellow_cards: number;
  red_cards: number;
  pass_accuracy: number;
};

export type TeamCompetitionStats = RecordSplit & {
  league: string;
  league_name: string;
  season: string;
  home: RecordSplit;
  away: RecordSplit;
  clean_sheets: number;
  failed_to_score: number;
  biggest_win: MatchRef | null;
  biggest_loss: MatchRef | null;
  /** null quando nenhum jogo detalhado tem estatística */
  averages: TeamAverages | null;
  top_scorers: { player_id: Id; name: string; headshot_url?: string; goals: number }[];
};

/** /team/stats */
export type TeamStats = { team_id: Id; competitions: TeamCompetitionStats[] };

// Lista da resposta: aceita [] ou { data: [] } (formato antigo de algumas rotas)
export function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const inner = (data as { data?: unknown } | null)?.data;
  return Array.isArray(inner) ? (inner as T[]) : [];
}

// /standings/chances: simulação do resto do campeonato. Percentuais com 1 casa decimal
export type ChancesTeam = {
  team_id: number;
  team_name: string;
  crest_url?: string;
  position: number;
  points: number;
  played: number;
  expected_points: number;
  title: number;
  /** zona (mesmo valor de zone da /standings) -> % */
  zones: Record<string, number>;
  /** % de terminar em cada posição: [1º, 2º, ...] */
  positions: number[];
};

export type StandingsChances = {
  league: string;
  season: string;
  simulations: number;
  remaining_matches: number;
  zones: string[];
  teams: ChancesTeam[];
};

// /team/cards: pendurados e suspensos do time (Séries A e B)
export type CardPlayer = {
  name: string;
  espn_player_id?: number;
  /** Só os amarelos que valem para o acúmulo */
  yellow_cards: number;
  red_cards: number;
  status?: 'suspended' | 'hanging' | string;
  /** "3º amarelo", "6º amarelo", "cartão vermelho" */
  reason?: string;
};

export type TeamCards = {
  team_id: number;
  league: string;
  season: string;
  yellows_for_suspension: number;
  matches_counted: number;
  /** Jogos encerrados sem os lances da ESPN: a lista pode estar incompleta */
  matches_without_data: number;
  next_match: { match_id: number; date: string; opponent: string; home: boolean } | null;
  suspended: CardPlayer[];
  hanging: CardPlayer[];
  players: CardPlayer[];
};

// /match/commentary: narração lance a lance, do mais recente para o mais antigo
export type CommentaryItem = { seq: number; minute: string; text: string; type?: string; team?: string };
