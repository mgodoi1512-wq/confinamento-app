/**
 * Constantes e listas de opções do domínio de confinamento.
 * Rótulos são chaves de tradução (public/locales/pt-BR.json).
 */

export const ARROBA_KG = 15;
/** Rendimento de carcaça padrão usado para converter peso vivo em arrobas. */
export const DEFAULT_CARCASS_YIELD = 52;
export const DEFAULT_TARGET_WEIGHT = 520;
export const HEAVY_ANIMAL_DAYS_WITHOUT_WEIGHING = 30;

export type Option = { value: string; labelKey: string };

/** Valor sentinela para "todos" nos filtros (Radix Select não aceita string vazia). */
export const SELECT_ALL = "all";

export const CATEGORY_OPTIONS: Option[] = [
  { value: "bezerro", labelKey: "status.category.bezerro" },
  { value: "garrote", labelKey: "status.category.garrote" },
  { value: "novilho", labelKey: "status.category.novilho" },
  { value: "novilha", labelKey: "status.category.novilha" },
  { value: "boi", labelKey: "status.category.boi" },
  { value: "vaca", labelKey: "status.category.vaca" },
];

export const SEX_OPTIONS: Option[] = [
  { value: "macho", labelKey: "status.sex.macho" },
  { value: "femea", labelKey: "status.sex.femea" },
];

export const BREED_OPTIONS: Option[] = [
  { value: "Nelore", labelKey: "Nelore" },
  { value: "Cruzamento Angus x Nelore", labelKey: "Cruzamento Angus x Nelore" },
  { value: "Cruzamento Hereford x Nelore", labelKey: "Cruzamento Hereford x Nelore" },
  { value: "Senepol", labelKey: "Senepol" },
  { value: "Brahman", labelKey: "Brahman" },
  { value: "Tabapuã", labelKey: "Tabapuã" },
  { value: "Girolando", labelKey: "Girolando" },
];

export const PEN_STATUS_OPTIONS: Option[] = [
  { value: "ativo", labelKey: "status.pen.ativo" },
  { value: "vazio", labelKey: "status.pen.vazio" },
  { value: "adaptacao", labelKey: "status.pen.adaptacao" },
  { value: "manutencao", labelKey: "status.pen.manutencao" },
];

/** Currais nestes status não recebem novos lotes. */
export const PEN_BLOCKED_STATUSES = ["manutencao"];

export const WEIGHING_KIND_OPTIONS: Option[] = [
  { value: "amostral", labelKey: "weighings.kind.amostral" },
  { value: "lote_completo", labelKey: "weighings.kind.lote_completo" },
  { value: "individual", labelKey: "weighings.kind.individual" },
];

export const FEED_SHIFT_OPTIONS: Option[] = [
  { value: "manha", labelKey: "feed.shift.manha" },
  { value: "tarde", labelKey: "feed.shift.tarde" },
  { value: "noite", labelKey: "feed.shift.noite" },
];

export const PROTOCOL_ITEM_KIND_OPTIONS: Option[] = [
  { value: "vacina", labelKey: "status.protocolItem.vacina" },
  { value: "vermifugo", labelKey: "status.protocolItem.vermifugo" },
  { value: "outro", labelKey: "status.protocolItem.outro" },
];

export const HEALTH_EVENT_KIND_OPTIONS: Option[] = [
  { value: "tratamento", labelKey: "status.event.tratamento" },
  { value: "vacina", labelKey: "status.event.vacina" },
  { value: "protocolo", labelKey: "status.event.protocolo" },
  { value: "obito", labelKey: "status.event.obito" },
];

export const ROLE_OPTIONS: Option[] = [
  { value: "gestor", labelKey: "status.role.gestor" },
  { value: "operador", labelKey: "status.role.operador" },
];

export const EXIT_REASON_OPTIONS: Option[] = [
  { value: "abate", labelKey: "lots.exit.kind.abate" },
  { value: "venda", labelKey: "lots.exit.kind.venda" },
  { value: "obito", labelKey: "lots.exit.kind.obito" },
];

export const WEIGHT_SCENARIOS = [
  { value: "conservative", labelKey: "lots.detail.scenario.conservative", factor: 0.9 },
  { value: "realistic", labelKey: "lots.detail.scenario.realistic", factor: 1 },
  { value: "optimistic", labelKey: "lots.detail.scenario.optimistic", factor: 1.1 },
] as const;

export type WeightScenario = (typeof WEIGHT_SCENARIOS)[number]["value"];

export const INGREDIENT_SUGGESTIONS = [
  "Silagem de milho",
  "Silagem de capim",
  "Milho moído",
  "Sorgo moído",
  "Farelo de soja",
  "Caroço de algodão",
  "Polpa cítrica",
  "Ureia pecuária",
  "Núcleo mineral",
  "Sal branco",
];
