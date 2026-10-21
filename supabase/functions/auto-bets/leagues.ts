// Leagues the auto-bets bot publishes from Polymarket.
//
// `seriesId` is Polymarket's league series (GET gamma-api.polymarket.com/sports
// lists them). `categorySlug` points at `public.categories.slug`; the
// 20261014120000 migration seeds every slug used here.
//
// How the bet title context ("Premier League: Arsenal - Chelsea") is built:
//   league           -> the league label
//   label_and_prefix -> label + Polymarket title prefix ("ATP Catania")
//   prefix           -> Polymarket title prefix, else the label ("UFC Fight Night")
//   stage            -> Polymarket esports stage, else the label
//                       ("Thunderpick World Championship Group A")

export type TitleContext = 'league' | 'label_and_prefix' | 'prefix' | 'stage';

export interface LeagueConfig {
  key: string;
  seriesId: string;
  label: string;
  categorySlug: string;
  titleContext: TitleContext;
  // Most markets per category per Warsaw calendar day (settled ones count),
  // picking the most liquid games first. Leagues sharing a category share the
  // cap. Omitted means every game that passes the filters.
  dailyCap?: number;
  // Football clubs carry legal affixes ("FC", "SSC", "Calcio") worth
  // stripping; esports orgs like "SK Gaming" must keep theirs.
  clubNames?: boolean;
}

export const LEAGUES: LeagueConfig[] = [
  { key: 'ucl', seriesId: '10204', label: 'Liga Mistrzów', categorySlug: 'football-ucl', titleContext: 'league', clubNames: true },
  { key: 'uel', seriesId: '10209', label: 'Liga Europy', categorySlug: 'football-uel', titleContext: 'league', clubNames: true },
  { key: 'pol', seriesId: '12320', label: 'Ekstraklasa', categorySlug: 'football-ekstraklasa', titleContext: 'league', clubNames: true },
  { key: 'epl', seriesId: '10188', label: 'Premier League', categorySlug: 'football-epl', titleContext: 'league', clubNames: true },
  { key: 'lal', seriesId: '10193', label: 'LaLiga', categorySlug: 'football-laliga', titleContext: 'league', clubNames: true },
  { key: 'sea', seriesId: '10203', label: 'Serie A', categorySlug: 'football-serie-a', titleContext: 'league', clubNames: true },
  { key: 'bun', seriesId: '10194', label: 'Bundesliga', categorySlug: 'football-bundesliga', titleContext: 'league', clubNames: true },
  { key: 'fl1', seriesId: '10195', label: 'Ligue 1', categorySlug: 'football-ligue-1', titleContext: 'league', clubNames: true },
  { key: 'unl', seriesId: '11446', label: 'Liga Narodów', categorySlug: 'football-national', titleContext: 'league', clubNames: true },
  { key: 'ewq', seriesId: '10243', label: 'Eliminacje MŚ', categorySlug: 'football-national', titleContext: 'league', clubNames: true },
  { key: 'nba', seriesId: '10345', label: 'NBA', categorySlug: 'basketball-nba', titleContext: 'league', dailyCap: 6 },
  { key: 'euroleague', seriesId: '10371', label: 'Euroliga', categorySlug: 'basketball-euroleague', titleContext: 'league', dailyCap: 5 },
  { key: 'nhl', seriesId: '10346', label: 'NHL', categorySlug: 'hockey', titleContext: 'league', dailyCap: 5 },
  { key: 'mlb', seriesId: '3', label: 'MLB', categorySlug: 'mlb', titleContext: 'league', dailyCap: 5 },
  { key: 'nfl', seriesId: '12185', label: 'NFL', categorySlug: 'nfl', titleContext: 'league', dailyCap: 6 },
  { key: 'ufc', seriesId: '38', label: 'UFC', categorySlug: 'ufc', titleContext: 'prefix', dailyCap: 6 },
  { key: 'atp', seriesId: '10365', label: 'ATP', categorySlug: 'tennis-atp', titleContext: 'label_and_prefix', dailyCap: 6 },
  { key: 'wta', seriesId: '10366', label: 'WTA', categorySlug: 'tennis-wta', titleContext: 'label_and_prefix', dailyCap: 4 },
  { key: 'cs2', seriesId: '10310', label: 'CS2', categorySlug: 'esports-cs2', titleContext: 'stage', dailyCap: 6 },
  { key: 'lol', seriesId: '10311', label: 'LoL', categorySlug: 'esports-lol', titleContext: 'stage', dailyCap: 5 },
  { key: 'dota2', seriesId: '10309', label: 'Dota 2', categorySlug: 'esports-dota2', titleContext: 'stage', dailyCap: 3 },
  { key: 'val', seriesId: '10369', label: 'Valorant', categorySlug: 'esports-valorant', titleContext: 'stage', dailyCap: 3 },
  { key: 'pdcdarts', seriesId: '12754', label: 'PDC', categorySlug: 'darts', titleContext: 'prefix', dailyCap: 6 },
  { key: 'vbplusliga', seriesId: '11921', label: 'PlusLiga', categorySlug: 'volleyball', titleContext: 'league' },
  { key: 'vbcl', seriesId: '11929', label: 'Liga Mistrzów siatkarzy', categorySlug: 'volleyball', titleContext: 'league' },
];

// Exact Polymarket names mapped to how Polish fans call the team. Checked
// before the generic club-affix cleanup in core.ts.
export const TEAM_NAME_ALIASES: Record<string, string> = {
  // Ekstraklasa: Polymarket drops diacritics and keeps legal prefixes.
  'GKS Piast Gliwice': 'Piast Gliwice',
  'Gornik Zabrze': 'Górnik Zabrze',
  'Jagiellonia Bialystok': 'Jagiellonia Białystok',
  'KKS Lech Poznan': 'Lech Poznań',
  'KKS Lech Poznań': 'Lech Poznań',
  'Lech Poznan': 'Lech Poznań',
  'KS Cracovia Krakow': 'Cracovia',
  'LKP Motor Lublin': 'Motor Lublin',
  'Pogon Szczecin': 'Pogoń Szczecin',
  'RKS Radomiak Radom': 'Radomiak Radom',
  'RKS Rakow Czestochowa': 'Raków Częstochowa',
  'WKS Slask Wroclaw': 'Śląsk Wrocław',
  'Widzew Lodz': 'Widzew Łódź',
  'Wieczysta Krakow': 'Wieczysta Kraków',
  'Wisla Krakow': 'Wisła Kraków',
  'Wisla Plock': 'Wisła Płock',
  'Zaglebie Lubin': 'Zagłębie Lubin',
  'Lechia Gdansk': 'Lechia Gdańsk',
  'Puszcza Niepolomice': 'Puszcza Niepołomice',
  'Bruk-Bet Termalica Nieciecza': 'Termalica Nieciecza',
  // European clubs with Polish exonyms or long official names.
  'FC Bayern München': 'Bayern Monachium',
  'Club Atlético de Madrid': 'Atlético Madryt',
  'Real Madrid CF': 'Real Madryt',
  'FC Internazionale Milano': 'Inter Mediolan',
  'BV Borussia 09 Dortmund': 'Borussia Dortmund',
  'Bayer 04 Leverkusen': 'Bayer Leverkusen',
  'Borussia Mönchengladbach': 'Borussia M\'gladbach',
  'SV Werder Bremen': 'Werder Brema',
  '1. FC Union Berlin': 'Union Berlin',
  '1. FSV Mainz 05': 'Mainz',
  'TSG 1899 Hoffenheim': 'Hoffenheim',
  'Paris Saint-Germain FC': 'PSG',
  'Paris FC': 'Paris FC',
  'Olympique Lyonnais': 'Lyon',
  'Olympique de Marseille': 'Marsylia',
  'Stade Rennais FC 1901': 'Rennes',
  'Racing Club de Lens': 'Lens',
  'RC Strasbourg Alsace': 'Strasbourg',
  'Stade Brestois 29': 'Brest',
  'Real Sociedad de Fútbol': 'Real Sociedad',
  'RCD Espanyol de Barcelona': 'Espanyol',
  'Rayo Vallecano de Madrid': 'Rayo Vallecano',
  'Real Betis Balompié': 'Real Betis',
  'Real Racing Club': 'Racing Santander',
  'Athletic Club': 'Athletic Bilbao',
  'Brighton & Hove Albion FC': 'Brighton',
  'Tottenham Hotspur FC': 'Tottenham',
  'Sport Lisboa e Benfica': 'Benfica',
  'Sporting CP': 'Sporting Lizbona',
  'FC Red Bull Salzburg': 'RB Salzburg',
  'Olympiakós SFP': 'Olympiakos',
  'Ferencvárosi TC': 'Ferencváros',
  'Feyenoord Rotterdam': 'Feyenoord',
  'FK Shakhtar Donetsk': 'Szachtar Donieck',
  'SK Slavia Praha': 'Slavia Praga',
  'AC Sparta Praha': 'Sparta Praga',
};
