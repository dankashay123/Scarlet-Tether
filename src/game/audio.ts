import Phaser from 'phaser';
import { meta } from './state';

export const SFX_KEYS = [
  'chain_swing',
  'chain_swing_heavy',
  'hit_flesh',
  'hit_flesh2',
  'hit_player',
  'dodge',
  'perfect_dodge',
  'execute',
  'devour',
  'death_enemy',
  'death_player',
  'footstep_wet',
  'pickup_tear',
  'heal',
  'ui_select',
  'ui_confirm',
  'ui_back',
  'page_turn',
  'door_open',
  'bell_distant',
  'choke',
  'spit',
  'sludge',
  'boss_roar',
  'heartbeat',
  'whisper',
  'amb_drip',
  'amb_hub',
  'music_boss',
] as const;

export type SfxKey = (typeof SFX_KEYS)[number];

const BASE_VOLUME: Partial<Record<SfxKey, number>> = {
  amb_drip: 0.9,
  amb_hub: 0.6,
  music_boss: 0.45,
  footstep_wet: 0.25,
  whisper: 0.5,
  heartbeat: 0.8,
  bell_distant: 0.5,
  ui_select: 0.5,
};

let loops: Map<string, Phaser.Sound.BaseSound> = new Map();
const loopGain: Map<string, number> = new Map();

function game(scene: Phaser.Scene) {
  return scene.sys.game;
}

export function sfx(scene: Phaser.Scene, key: SfxKey, opts: { volume?: number; rate?: number; detune?: number } = {}) {
  const sm = game(scene).sound;
  if (!scene.cache.audio.exists(key)) return;
  const vol = (opts.volume ?? 1) * (BASE_VOLUME[key] ?? 0.8) * meta().settings.sfx;
  if (vol <= 0) return;
  try {
    sm.play(key, { volume: vol, rate: opts.rate ?? 1, detune: opts.detune ?? (Math.random() - 0.5) * 120 });
  } catch {
    // Audio is decoration; never let it crash a frame.
  }
}

/** Start (or keep) a looping bed. Other beds in the same channel fade out. */
export function loop(scene: Phaser.Scene, key: SfxKey, channel: 'amb' | 'music', volume = 1) {
  const sm = game(scene).sound;
  const id = `${channel}`;
  const current = loops.get(id);
  if (current && current.key === key) return;
  if (current) fadeOut(scene, current);
  loops.delete(id);
  if (!scene.cache.audio.exists(key)) return;
  const setting = channel === 'music' ? meta().settings.music : meta().settings.sfx;
  const target = volume * (BASE_VOLUME[key] ?? 0.6) * setting;
  try {
    const s = sm.add(key, { loop: true, volume: 0 });
    // Skip MP3 encoder padding so the loop doesn't tick.
    s.play({ seek: 0.03 });
    fade(s, target, 1200);
    loops.set(id, s);
    loopGain.set(id, volume);
  } catch {
    /* ignore */
  }
}

export function stopLoop(scene: Phaser.Scene, channel: 'amb' | 'music') {
  const s = loops.get(channel);
  if (s) fadeOut(scene, s);
  loops.delete(channel);
}

type Vol = Phaser.Sound.BaseSound & { volume: number; manager: unknown };

/** Scene-independent volume ramp that survives scene changes. */
function fade(s: Phaser.Sound.BaseSound, to: number, ms: number, done?: () => void) {
  const v = s as Vol;
  const from = v.volume;
  const t0 = performance.now();
  const id = setInterval(() => {
    if (!v.manager) {
      clearInterval(id);
      return;
    }
    const k = Math.min(1, (performance.now() - t0) / ms);
    v.volume = from + (to - from) * k;
    if (k >= 1) {
      clearInterval(id);
      done?.();
    }
  }, 30);
}

function fadeOut(_scene: Phaser.Scene, s: Phaser.Sound.BaseSound) {
  fade(s, 0, 900, () => s.destroy());
}

/** Re-apply settings to playing loops (after toggling sound or music). */
export function refreshLoopVolumes() {
  for (const [id, s] of loops) {
    const ws = s as Phaser.Sound.WebAudioSound;
    const base = BASE_VOLUME[s.key as SfxKey] ?? 0.6;
    const setting = id === 'music' ? meta().settings.music : meta().settings.sfx;
    if ('setVolume' in ws) ws.setVolume(base * (loopGain.get(id) ?? 1) * setting);
  }
}

/** Scale a live loop's volume (e.g. muffle the city above at low Lucidity). */
export function loopVolume(channel: 'amb' | 'music', v: number) {
  const s = loops.get(channel) as Phaser.Sound.WebAudioSound | undefined;
  if (s && 'setVolume' in s) {
    const base = BASE_VOLUME[s.key as SfxKey] ?? 0.6;
    const setting = channel === 'music' ? meta().settings.music : meta().settings.sfx;
    s.setVolume(base * v * (loopGain.get(channel) ?? 1) * setting);
  }
}

export function resetLoops() {
  for (const s of loops.values()) s.destroy();
  loops = new Map();
}
