import { makeCitizen, type Citizen } from './citizens';

export type StigmaId = 'maw' | 'helix';

export interface LifeRecord {
  name: string;
  occupation: string;
  fate: string;
}

export interface MetaState {
  version: number;
  seenIntro: boolean;
  tears: number;
  vertebrae: number;
  unlocked: StigmaId[];
  equipped: StigmaId[];
  upgrades: { vigor: number; censer: number; lucidity: number };
  weapon: { length: number; weight: number; marrow: number };
  weightOfSin: number;
  citizen: Citizen;
  lineage: LifeRecord[];
  deaths: number;
  bossKills: number;
  runs: number;
  bestRoom: number;
  flags: Record<string, boolean>;
  /** Collectibles: Reliquary Shards (3 = +max HP), freed Caged Cherubs (3 = +max Lucidity), Marks of Contrition (upgrade tokens). */
  shards: number;
  cherubs: number;
  marks: number;
  /** Rites bought from Deacon Vivisect with Marks. */
  rites: Record<string, number>;
  settings: { sfx: number; music: number; shake: boolean; leftHanded: boolean; bigButtons: boolean };
}

const KEY = 'scarlet-tether-save-v1';
const VERSION = 1;

function fresh(): MetaState {
  return {
    version: VERSION,
    seenIntro: false,
    tears: 0,
    vertebrae: 0,
    unlocked: [],
    equipped: [],
    upgrades: { vigor: 0, censer: 0, lucidity: 0 },
    weapon: { length: 0, weight: 0, marrow: 0 },
    weightOfSin: 0,
    citizen: makeCitizen(Math.floor(Math.random() * 1e9)),
    lineage: [],
    deaths: 0,
    bossKills: 0,
    runs: 0,
    bestRoom: 0,
    flags: {},
    shards: 0,
    cherubs: 0,
    marks: 0,
    rites: {},
    settings: { sfx: 1, music: 1, shake: true, leftHanded: false, bigButtons: false },
  };
}

let state: MetaState | null = null;

export function meta(): MetaState {
  if (state) return state;
  let loaded: MetaState | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) loaded = JSON.parse(raw) as MetaState;
  } catch {
    loaded = null;
  }
  const base = fresh();
  state = loaded && loaded.version === VERSION ? { ...base, ...loaded, settings: { ...base.settings, ...loaded.settings } } : base;
  return state;
}

/** Level of a Rite bought with Marks of Contrition (0 if never). */
export function rite(k: RiteId): number {
  return meta().rites?.[k] ?? 0;
}

export type RiteId = 'lash' | 'lunge' | 'finisher' | 'bloodrite' | 'iron';

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta()));
  } catch {
    // Private mode or storage full: progress lives for this session only.
  }
}

export function wipeSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  state = fresh();
}

// ---------------------------------------------------------------------------
// Derived stats
// ---------------------------------------------------------------------------

export const STIGMA_LUCIDITY_TOLL = 15;
export const SIN_LUCIDITY_TOLL = 3;

export function maxHp(m = meta()) {
  return 100 + m.upgrades.vigor * 12 + Math.floor((m.shards ?? 0) / 3) * 15;
}
export function maxStamina(m = meta()) {
  return 100 + m.upgrades.censer * 12;
}
export function maxLucidity(m = meta()) {
  return 100 + m.upgrades.lucidity * 10 + Math.floor((m.cherubs ?? 0) / 3) * 10;
}
/** Lucidity a new descent begins with: stigmas and inherited sin weigh on the mind. */
export function startingLucidity(m = meta()) {
  return Math.max(
    20,
    maxLucidity(m) - m.equipped.length * STIGMA_LUCIDITY_TOLL - m.weightOfSin * SIN_LUCIDITY_TOLL,
  );
}

// ---------------------------------------------------------------------------
// Per-descent state
// ---------------------------------------------------------------------------

export interface RunState {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  lucidity: number;
  maxLucidity: number;
  tears: number; // carried this descent
  vertebrae: number;
  sacraments: string[];
  sin: number; // trauma accumulated this descent
  room: number; // rooms cleared
  executions: number;
  kills: number;
  devoured: number;
  confessionsHeard: string[];
}

let run: RunState | null = null;

export function newRun(): RunState {
  const m = meta();
  run = {
    hp: maxHp(m),
    maxHp: maxHp(m),
    stamina: maxStamina(m),
    maxStamina: maxStamina(m),
    lucidity: startingLucidity(m),
    maxLucidity: maxLucidity(m),
    tears: 0,
    vertebrae: 0,
    sacraments: [],
    sin: 0,
    room: 0,
    executions: 0,
    kills: 0,
    devoured: 0,
    confessionsHeard: [],
  };
  return run;
}

export function currentRun(): RunState {
  return run ?? newRun();
}

export function hasSacrament(id: string) {
  return currentRun().sacraments.includes(id);
}
