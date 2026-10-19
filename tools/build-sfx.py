#!/usr/bin/env python3
# Builds the sound effects in assets/audio/*.mp3 from the free packs in
# docs/CREDITS.md. The packs are not committed: download each one and unzip
# it into <src>/<pack> (the OpenGameArt page name, e.g. 80-cc0-rpg-sfx) and
# the Kenney packs into <src>/kenney/<pack>. Then:
#   python3 tools/build-sfx.py <src> [name ...]
# Needs ffmpeg and numpy. Each effect is a list of layers (a take from a
# file, trimmed, pitched, offset and mixed), then a fade, an optional hall
# reverb, and a peak level. Music and ambience loops: tools/build-audio.sh.
import glob, os, subprocess, sys
import numpy as np

SR = 44100
SRC = sys.argv[1] if len(sys.argv) > 1 else sys.exit('usage: build-sfx.py <src> [name ...]')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio')
_found = {}

def find(pack, name):
    """A file by pack and base name, anywhere under the pack folder."""
    k = (pack, name)
    if k not in _found:
        hits = [p for p in glob.glob(os.path.join(SRC, pack, '**', '*'), recursive=True) if os.path.basename(p) == name]
        if not hits: sys.exit(f'missing {pack}/{name}')
        _found[k] = hits[0]
    return _found[k]

def load(path):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).astype(np.float64)

def takes(x, rel=0.03, gap=0.12):
    """Start and end of each take (sound separated by silence)."""
    a = np.abs(x); env = np.convolve(a, np.ones(441) / 441, 'same'); on = env > a.max() * rel
    out, i, n, g = [], 0, len(x), int(gap * SR)
    while i < n:
        if not on[i]: i += 1; continue
        s = last = i
        while i < n and (on[i] or i - last < g):
            if on[i]: last = i
            i += 1
        if (last - s) / SR > 0.02: out.append((s, last))
    return out

def L(pack, name, take=0, at=0.0, db=0.0, rate=1.0, skip=0.0, dur=None, fade=0.03, hp=0, lp=0, pk=False):
    """One layer: take `take` of a file, `skip` s in, `dur` s long, played at `rate`, `at` s into the mix.
    pk starts the layer just before its loudest moment (a hit without its run-up)."""
    return dict(pack=pack, name=name, take=take, at=at, db=db, rate=rate, skip=skip, dur=dur, fade=fade, hp=hp, lp=lp, pk=pk)

def onepole(x, f, high):
    if not f: return x
    k = np.exp(-2 * np.pi * f / SR); y = np.empty_like(x); s = 0.0
    for i, v in enumerate(x): s = (1 - k) * v + k * s; y[i] = s
    return x - y if high else y

def layer(l):
    x = load(find(l['pack'], l['name']))
    tk = takes(x)
    s, e = tk[min(l['take'], len(tk) - 1)] if tk else (0, len(x) - 1)
    if l['pk']: env = np.convolve(np.abs(x[s:e]), np.ones(88) / 88, 'same'); s += int(np.argmax(env)) - int(0.006 * SR)
    s = max(0, s - int(0.003 * SR)) + int(l['skip'] * SR)
    e = min(len(x), e + int(0.25 * SR))
    if l['dur']: e = min(e, s + int(l['dur'] * l['rate'] * SR))
    y = x[s:e]
    if l['rate'] != 1: y = np.interp(np.arange(0, len(y) - 1, l['rate']), np.arange(len(y)), y)
    y = onepole(onepole(y, l['hp'], True), l['lp'], False)
    f = min(len(y), int(l['fade'] * SR))
    if f: y[-f:] *= np.linspace(1, 0, f) ** 2
    return y * 10 ** (l['db'] / 20)

def hall(x, wet, secs, bright=4000):
    """A stone-hall reverb: convolve with decaying, darkened noise."""
    n = int(secs * SR); t = np.arange(n) / SR
    rng = np.random.default_rng(7)
    ir = onepole(rng.standard_normal(n) * np.exp(-t * 6.9 / secs), bright, False)
    ir[: int(0.012 * SR)] = 0  # a short pre-delay
    ir /= np.sqrt((ir ** 2).sum())
    m = len(x) + n; F = 1 << (m - 1).bit_length()
    w = np.fft.irfft(np.fft.rfft(x, F) * np.fft.rfft(ir, F), F)[:m]
    y = np.concatenate([x, np.zeros(n)])
    return y + w * wet

def loud(x):
    """Level of the loudest tenth of a second (RMS, dBFS)."""
    w = SR // 10; c = np.convolve(x * x, np.ones(w) / w, 'valid') if len(x) > w else [np.mean(x * x)]
    return 10 * np.log10(np.max(c) + 1e-12)

def build(name, layers, length=None, fade=0.05, rev=None, lu=-14.0, peak=-1.0, br='96k'):
    """lu: the loudness to level to, so the game's VOL table stays fair; peaks over -3 dB are softly limited."""
    parts = [(int(l['at'] * SR), layer(l)) for l in layers]
    n = max(o + len(y) for o, y in parts)
    mix = np.zeros(n)
    for o, y in parts: mix[o:o + len(y)] += y
    if rev: mix = hall(mix, *rev)
    if length: mix = mix[: int(length * SR)]
    # Trim the tail once it falls under -60 dB, then fade.
    a = np.abs(mix); idx = np.where(a > a.max() * 1e-3)[0]; mix = mix[: idx[-1] + 1]
    f = min(len(mix), int(fade * SR)); mix[-f:] *= np.linspace(1, 0, f) ** 1.5
    mix *= 10 ** ((lu - loud(mix)) / 20)
    t = 10 ** (-3 / 20); a = np.abs(mix); over = a > t
    mix[over] = np.sign(mix[over]) * (t + (1 - t) * np.tanh((a[over] - t) / (1 - t)))
    mix *= min(1, 10 ** (peak / 20) / (np.abs(mix).max() + 1e-12))
    out = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', br, out], input=mix.tobytes(), check=True)
    print(f'{name:10s} {len(mix) / SR:5.2f} s  {loud(mix):6.1f} dB')

# Packs (see docs/CREDITS.md).
MED = 'medieval-sound-effects-weapon-textures'; MEDI = 'medieval-sound-effects-weapon-impacts'
HITS = '37-hitspunches'; WET = '8-wet-squish-slurp-impacts'; BONE = 'deep-bone-crackbreak-sfx'
RPG = '80-cc0-rpg-sfx'; C100 = '100-cc0-sfx'; BFH = '75-cc0-breaking-falling-hit-sfx'; WATER = '40-cc0-water-splash-slime-sfx'
TINY = 'fantasy-sound-effects-tinysized-sfx'; ART = 'rpg-sound-pack'; SWISH = 'swishes-sound-pack'; BELL = 'bell-dingschimes'
CURE = 'cure-magic'; MAGIC = 'magic-spell-sfx'; CHANT = 'creepy-incoherent-chanting'; ROAR = 'cc0-deep-monster-roar'
FIREB = 'fireball-1'; GHAST = '7-ghast-sounds'; CHEST = 'open-chest-sfx'; COINS = '12-coin-sound-effects'; UI = '51-ui-sound-effects-buttons-switches-and-clicks'
KI = 'kenney/impact-sounds'; KR = 'kenney/rpg-audio'; KS = 'kenney/sci-fi-sounds'; KU = 'kenney/interface-sounds'

SFX = {
    # --- combat ---
    # The Saint's crossbow: a real crossbow release, kept short (it fires all the time).
    'shoot': lambda: build('shoot', [L(MED, 'Crossbow Shoot.wav', 0, dur=0.11, hp=120), L(KI, 'impactWood_light_002.ogg', db=-14, dur=0.06)], fade=0.03, lu=-20),
    'hit0': lambda: build('hit0', [L(HITS, 'hit09.mp3.flac', dur=0.16, pk=True), L(WET, 'impactsplat02.mp3.flac', db=-12, dur=0.1, pk=True)], fade=0.1, lu=-13),
    'hit1': lambda: build('hit1', [L(HITS, 'hit10.mp3.flac', dur=0.16, pk=True), L(WET, 'impactsplat03.mp3.flac', db=-12, dur=0.1, pk=True)], fade=0.1, lu=-13),
    'hit2': lambda: build('hit2', [L(HITS, 'hit14.mp3.flac', dur=0.16, pk=True), L(WET, 'impactsplat01.mp3.flac', db=-12, dur=0.1, pk=True)], fade=0.1, lu=-13.5),
    'block': lambda: build('block', [L(MEDI, 'Mace Norse Sword Blade.wav', dur=0.45, hp=200), L(KI, 'impactMetal_light_001.ogg', db=-8)], fade=0.2, lu=-18.5),
    'kill0': lambda: build('kill0', [L(WET, 'impactsplat01.mp3.flac', dur=0.45), L(BONE, 'Deep Break 10.wav', db=-5, dur=0.25), L(HITS, 'hit02.mp3.flac', db=-6, dur=0.2)], fade=0.15, lu=-11),
    'kill1': lambda: build('kill1', [L(WET, 'impactsplat06.mp3.flac', dur=0.45), L(BONE, 'Deep Break 7.wav', db=-5, dur=0.25), L(HITS, 'hit06.mp3.flac', db=-6, dur=0.2)], fade=0.15, lu=-11),
    'hurt': lambda: build('hurt', [L(HITS, 'hit01.mp3.flac', rate=0.82, dur=0.35), L(KI, 'impactPunch_heavy_003.ogg', rate=0.8, db=-4)], fade=0.15, lu=-10.5),
    'execute': lambda: build('execute', [L(MED, 'Sabre Swing.wav', dur=0.3), L(WET, 'impactsplat05.mp3.flac', at=0.12, dur=0.6), L(BONE, 'Deep Break 1.wav', at=0.12, db=-3, dur=0.35), L(KI, 'impactPunch_heavy_004.ogg', at=0.12, db=-6)], fade=0.3, rev=(0.18, 1.2), lu=-12),
    'break': lambda: build('break', [L(KI, 'impactWood_heavy_001.ogg'), L(BFH, 'bfh1_breaking_01.ogg', db=-3, dur=0.6), L(BFH, 'bfh1_rock_breaking_01.ogg', db=-9, dur=0.4)], fade=0.2, lu=-15.5),
    'perfect': lambda: build('perfect', [L(BELL, 'bell_ding2.wav', rate=1.25), L(SWISH, 'swish-3.wav', db=-6)], fade=0.4, rev=(0.35, 1.6), lu=-14),
    # --- rites ---
    'thurible': lambda: build('thurible', [L(RPG, 'chain_02.ogg', dur=0.25), L(RPG, 'metal_03.ogg', db=-8, dur=0.2)], fade=0.1, lu=-18),
    'flask': lambda: build('flask', [L(BFH, 'bfh1_glass_breaking_02.ogg', dur=0.5), L(WATER, 'splash_03.ogg', at=0.03, db=-3, dur=0.6)], fade=0.25, lu=-17),
    'chain': lambda: build('chain', [L(RPG, 'chain_01.ogg'), L(RPG, 'chain_03.ogg', at=0.05, db=-5, dur=0.4)], fade=0.15, lu=-15),
    'penance': lambda: build('penance', [L(C100, 'gong_01.ogg', rate=0.62), L(KI, 'impactBell_heavy_000.ogg', rate=0.8, db=-3), L(KS, 'lowFrequency_explosion_000.ogg', db=-10)], fade=0.8, rev=(0.6, 2.8, 2500), lu=-13),
    # --- the world ---
    'gate_lock': lambda: build('gate_lock', [L(C100, 'slam_03.ogg'), L(KI, 'impactMetal_heavy_000.ogg', db=-3)], fade=0.3, rev=(0.3, 1.4), lu=-14),
    'gate_open': lambda: build('gate_open', [L(KR, 'doorOpen_1.ogg'), L(KR, 'creak1.ogg', db=-4)], fade=0.3, rev=(0.2, 1.2), lu=-15),
    'pickup': lambda: build('pickup', [L(RPG, 'item_gem_03.ogg', db=-2), L(ART, 'armor-light.wav', db=-4, dur=0.3, pk=True)], fade=0.1, lu=-20),
    'heal': lambda: build('heal', [L(CURE, 'Cure3.wav', dur=0.6)], fade=0.25, rev=(0.2, 1.0), lu=-12),
    'gold': lambda: build('gold', [L(RPG, 'item_coins_01.ogg', dur=0.3), L(COINS, 'coin.3.ogg', db=-8, dur=0.25)], fade=0.1, lu=-22),
    'shrine': lambda: build('shrine', [L(MAGIC, 'magical_3.ogg'), L(BELL, 'bell_ding3.wav', at=0.05, db=-4)], fade=0.6, rev=(0.4, 2.2), lu=-14),
    'chest': lambda: build('chest', [L(CHEST, 'open chest_0.wav', dur=1.0), L(RPG, 'item_coins_04.ogg', at=0.35, db=-6, dur=0.8)], fade=0.4, lu=-16),
    'elite': lambda: build('elite', [L(C100, 'gong_02.ogg', rate=0.6), L(ROAR, 'monster_roar.wav', db=-9, dur=1.6, rate=0.9), L(KS, 'lowFrequency_explosion_001.ogg', db=-6)], fade=0.8, rev=(0.5, 2.6, 2500), lu=-9),
    'death': lambda: build('death', [L(KI, 'impactBell_heavy_003.ogg', rate=0.6), L(C100, 'gong_01.ogg', rate=0.45, db=-4), L(CHANT, 'chant3.wav', at=0.2, db=-8, dur=2.4)], length=3.6, fade=1.4, rev=(0.6, 3.2, 2200), lu=-8.5),
    'tap': lambda: build('tap', [L(UI, 'click3.wav', dur=0.06, pk=True)], fade=0.03, lu=-27),
    # --- new in round 23 ---
    'dash': lambda: build('dash', [L(SWISH, 'swish-5.wav', rate=0.9), L(TINY, 'tube-plastic-whoosh-01.wav', db=-10, dur=0.18, fade=0.08)], fade=0.08, lu=-17),
    'eshot': lambda: build('eshot', [L(RPG, 'spell_02.ogg', dur=0.3, rate=1.1), L(GHAST, 'ghast_fireball.1.ogg', db=-10, dur=0.3, rate=1.3, pk=True)], fade=0.15, lu=-18),
    'knell': lambda: build('knell', [L(C100, 'bell_02.ogg', rate=0.75)], fade=0.4, rev=(0.35, 1.4), lu=-18),
    'drip': lambda: build('drip', [L(TINY, 'water-drop-02.wav')], fade=0.1, rev=(0.45, 1.8), lu=-20),
    'roar': lambda: build('roar', [L(ROAR, 'monster_roar.wav', dur=2.4), L(RPG, 'creature_roar_02.ogg', rate=0.7, db=-6)], fade=0.8, rev=(0.35, 2.4, 2500), lu=-9),
    'levelup': lambda: build('levelup', [L(MAGIC, 'magical_4.ogg'), L(BELL, 'bell_ding4.wav', at=0.15, rate=1.2, db=-3)], fade=0.6, rev=(0.4, 2.0), lu=-12),
    'legend': lambda: build('legend', [L(BELL, 'bell_ding3.wav', rate=0.9), L(MAGIC, 'magical_5.ogg', db=-4), L(CHANT, 'ethereal_chant_Subclip 03_03.wav', db=-8, dur=1.5)], length=2.4, fade=0.8, rev=(0.45, 2.4), lu=-11),
    'buy': lambda: build('buy', [L(TINY, 'coins-shake-01.wav', dur=0.5), L(RPG, 'item_coins_02.ogg', db=-5, dur=0.35)], fade=0.15, lu=-17),
    # The Ashen Altar: the flame, a power learned, a piece turned to ash, three ground down.
    'burn': lambda: build('burn', [L(FIREB, '105016__julien-matthey__jm-fx-fireball-01.wav'), L(RPG, 'spell_fire_06.ogg', at=0.2, db=-2)], fade=0.5, rev=(0.25, 1.6), lu=-11),
    'learn': lambda: build('learn', [L(BELL, 'bell_ding3.wav', rate=0.8), L(BELL, 'bell_ding2.wav', at=0.18, rate=1.0, db=-3), L(CHANT, 'ethereal_chant_Subclip 05_05.wav', db=-6, dur=2.0)], length=3.0, fade=1.0, rev=(0.55, 2.8), lu=-11),
    'ash': lambda: build('ash', [L(BFH, 'bfh1_rock_falling_03.ogg', dur=0.8), L(BONE, 'Deep Break 4.wav', db=-4, dur=0.4), L(RPG, 'spell_fire_07.ogg', at=0.1, db=-6)], fade=0.4, rev=(0.25, 1.6), lu=-13),
    'grind': lambda: build('grind', [L(BFH, 'bfh1_rock_breaking_02.ogg', dur=0.6), L(RPG, 'stones_02.ogg', at=0.15, db=-3, dur=0.6)], fade=0.3, rev=(0.2, 1.2), lu=-14),
}

def loop(name, pack, file, start, secs, xf=1.5, lu=-24.0, hp=0, lp=0, br='48k'):
    """A seamless loop: the tail is crossfaded into the head."""
    x = load(find(pack, file))[int(start * SR):int((start + secs + xf) * SR)]
    x = onepole(onepole(x, hp, True), lp, False)
    n, f = int(secs * SR), int(xf * SR); w = np.linspace(0, 1, f)
    y = x[:n].copy(); y[:f] = x[:f] * np.sqrt(w) + x[n:n + f] * np.sqrt(1 - w)
    y *= 10 ** ((lu - 10 * np.log10(np.mean(y * y) + 1e-12)) / 20)
    y *= min(1, 0.9 / np.abs(y).max())
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', br, os.path.join(OUT, name + '.mp3')], input=y.tobytes(), check=True)
    print(f'{name:10s} {secs:5.2f} s loop')

def music(name, pack, file, start=0.0, secs=None, xf=3.0, lu=-20.0, lp=0, br='96k', seamless=False):
    """A stereo music loop. A seamless source plays whole; any other has its
    tail (the xf seconds after `secs`) crossfaded over its head."""
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', find(pack, file), '-ac', '2', '-ar', str(SR), '-f', 'f64le', '-'], capture_output=True, check=True)
    x = np.frombuffer(r.stdout, np.float64).reshape(-1, 2)[int(start * SR):].copy()
    if lp: x = np.stack([onepole(x[:, c], lp, False) for c in (0, 1)], 1)
    if seamless: y = x if not secs else x[:int(secs * SR)]
    else:
        n = int((secs or (len(x) / SR - xf)) * SR); f = int(xf * SR); w = np.linspace(0, 1, f)[:, None]
        y = x[:n].copy(); y[:f] = x[:f] * np.sqrt(w) + x[n:n + f] * np.sqrt(1 - w)
    y *= 10 ** ((lu - 10 * np.log10(np.mean(y ** 2) + 1e-12)) / 20)
    y *= min(1, 0.95 / np.abs(y).max())
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(SR), '-ac', '2', '-i', '-', '-b:a', br, os.path.join(OUT, name + '.mp3')], input=y.tobytes(), check=True)
    print(f'{name:14s} {len(y) / SR:6.1f} s music')

# Monster deaths by family (two of each; the game voices only some deaths).
NPC = 'rpg-sound-pack'; C80 = '80-cc0-creature-sfx'; C80B = '80-cc0-creture-sfx-2'; GHOST = 'ghost-monster-voice-moaning-growling'
TROLL = 'big-scary-troll-sounds'; HORROR = 'horror-sfx'
for k, v in {
    'die_bone0': lambda: build('die_bone0', [L(BONE, 'Deep Break 3.wav', dur=0.3, pk=True), L(RPG, 'stones_01.ogg', at=0.04, db=-4, dur=0.35), L(RPG, 'wood_02.ogg', at=0.08, db=-8)], fade=0.15, lu=-14),
    'die_bone1': lambda: build('die_bone1', [L(BONE, 'Deep Break 8.wav', dur=0.3, pk=True), L(BFH, 'bfh1_rock_falling_05.ogg', at=0.05, db=-5), L(RPG, 'stones_03.ogg', at=0.1, db=-8, dur=0.3)], fade=0.15, lu=-14),
    'die_flesh0': lambda: build('die_flesh0', [L(NPC, 'mnstr5.wav', rate=0.9), L(WET, 'impactsplat04.mp3.flac', db=-8, dur=0.3, pk=True)], fade=0.2, lu=-15),
    'die_flesh1': lambda: build('die_flesh1', [L(NPC, 'mnstr9.wav', rate=0.85), L(C80, 'grunt_02.ogg', db=-6)], fade=0.2, lu=-15),
    'die_spirit0': lambda: build('die_spirit0', [L(NPC, 'shade8.wav', dur=1.0)], fade=0.4, rev=(0.35, 1.6), lu=-17),
    'die_spirit1': lambda: build('die_spirit1', [L(GHOST, 'qubodup-GhostMoan01.wav', dur=0.9, rate=1.2)], fade=0.4, rev=(0.35, 1.6), lu=-17),
    'die_vermin0': lambda: build('die_vermin0', [L(C80, 'hurt_02.ogg', rate=1.1), L(C80, 'bug_02.ogg', db=-6)], fade=0.12, lu=-17),
    'die_vermin1': lambda: build('die_vermin1', [L(C80, 'misc_06.ogg'), L(NPC, 'bite-small2.wav', db=-6)], fade=0.12, lu=-17),
    'die_cleric0': lambda: build('die_cleric0', [L(C80B, 'die_03.ogg'), L(HITS, 'hit06.mp3.flac', db=-10, dur=0.15, pk=True)], fade=0.2, rev=(0.2, 1.2), lu=-15),
    'die_cleric1': lambda: build('die_cleric1', [L(C80B, 'human_07.ogg', rate=0.9)], fade=0.2, rev=(0.2, 1.2), lu=-15),
    # Each Warden's roar (it comes) and fall (it dies).
    'roar_bellwright': lambda: build('roar_bellwright', [L(C100, 'gong_01.ogg', rate=0.8), L(TROLL, 'troll-roars_0.ogg', 0, at=0.1, db=-2)], fade=0.8, rev=(0.45, 2.4, 2500), lu=-9),
    'fall_bellwright': lambda: build('fall_bellwright', [L(KI, 'impactBell_heavy_004.ogg', rate=0.5), L(BFH, 'bfh1_metal_falling_01.ogg', at=0.3, db=-3), L(C100, 'gong_02.ogg', at=0.6, rate=0.5, db=-2)], fade=1.2, rev=(0.55, 3.0, 2200), lu=-9),
    'roar_candlemass': lambda: build('roar_candlemass', [L(FIREB, '105016__julien-matthey__jm-fx-fireball-01.wav', db=-3), L(GHAST, 'ghast_cries.3.ogg', at=0.1, rate=0.85)], fade=0.7, rev=(0.35, 2.0), lu=-9),
    'fall_candlemass': lambda: build('fall_candlemass', [L(GHAST, 'ghast_hurt.2.ogg', rate=0.75), L(RPG, 'spell_fire_03.ogg', at=0.2, db=-2), L(C80, 'breath.ogg', at=1.0, rate=0.6, db=-6)], fade=1.0, rev=(0.45, 2.6), lu=-9),
    'roar_cardinal': lambda: build('roar_cardinal', [L(ROAR, 'monster_roar.wav', rate=1.1, dur=1.8), L(CHANT, 'ethereal_chant_Subclip 07_07.wav', db=-6, dur=2.0)], fade=0.8, rev=(0.5, 2.8), lu=-9),
    'fall_cardinal': lambda: build('fall_cardinal', [L(C80, 'scream_02.ogg', rate=0.7), L(C100, 'gong_01.ogg', at=0.3, rate=0.45, db=-3), L(CHANT, 'ethereal_chant_Subclip 09_09.wav', at=0.4, db=-6, dur=2.2)], length=3.6, fade=1.4, rev=(0.6, 3.2, 2200), lu=-9),
    'roar_charnelKing': lambda: build('roar_charnelKing', [L(TROLL, 'troll-roars_0.ogg', 1, rate=0.8), L(BONE, 'Deep Break 5.wav', at=0.05, db=-4, dur=0.4)], fade=0.8, rev=(0.4, 2.4, 2500), lu=-9),
    'fall_charnelKing': lambda: build('fall_charnelKing', [L(BFH, 'bfh1_rock_falling_01.ogg'), L(BFH, 'bfh1_rock_falling_06.ogg', at=0.3, db=-2), L(BONE, 'Deep Break 2.wav', at=0.1, db=-3), L(BONE, 'Deep Break 6.wav', at=0.5, db=-4), L(KS, 'lowFrequency_explosion_000.ogg', db=-4)], fade=1.0, rev=(0.45, 2.6, 2500), lu=-9),
    'roar_ladyOfNails': lambda: build('roar_ladyOfNails', [L(HORROR, 'horror_effect2.wav', dur=2.2), L(RPG, 'metal_02.ogg', db=-4), L(RPG, 'chain_03.ogg', at=0.3, db=-6)], fade=0.8, rev=(0.4, 2.4), lu=-9),
    'fall_ladyOfNails': lambda: build('fall_ladyOfNails', [L(C80, 'scream_01.ogg', rate=0.8), L(BFH, 'bfh1_metal_falling_02.ogg', at=0.25, db=-2), L(BFH, 'bfh1_metal_hit_03.ogg', at=0.6, db=-4)], fade=1.0, rev=(0.5, 2.8), lu=-9),
    'roar_tideBishop': lambda: build('roar_tideBishop', [L(C80B, 'roar_05.ogg', rate=0.7), L(WATER, 'splash_10.ogg', db=-3)], fade=0.8, rev=(0.45, 2.4, 2200), lu=-9),
    'fall_tideBishop': lambda: build('fall_tideBishop', [L(WATER, 'splash_12.ogg'), L(C80B, 'roar_06.ogg', at=0.1, rate=0.6, db=-3), L(WATER, 'loop_bubbles_1.ogg', at=0.4, db=-6, dur=2.0, fade=0.8)], fade=1.0, rev=(0.4, 2.6, 2200), lu=-9),
    'roar_organist': lambda: build('roar_organist', [L(C80, 'monster_04.ogg', rate=0.9), L(C100, 'gong_01.ogg', rate=0.5, db=-4), L(HORROR, 'horror_effect1.wav', db=-6, dur=2.2)], fade=0.8, rev=(0.55, 3.0, 2200), lu=-9),
    'fall_organist': lambda: build('fall_organist', [L(KI, 'impactBell_heavy_002.ogg', rate=0.55), L(HORROR, 'horror_effect1.wav', skip=2.0, db=-3, dur=2.6, fade=1.0), L(C80B, 'monster_20.ogg', at=0.2, rate=0.7, db=-4)], length=3.6, fade=1.4, rev=(0.6, 3.2, 2200), lu=-9),
}.items(): SFX[k] = v

# Music: Vael's chant (the sung one rises near the cathedral), each stratum, the Warden's sting.
SFX['music_town'] = lambda: music('music_town', 'chant-instrumental', 'ChantInstrumental_0.mp3', 0, None, 4, lu=-21)
SFX['amb_choir'] = lambda: music('amb_choir', 'chant', 'chant_0.ogg', 0, None, 4, lu=-21)
SFX['music_undercroft'] = lambda: music('music_undercroft', 'evil-temple-ambiance-loop', 'evil_temple.ogg', seamless=True, lu=-20)
SFX['music_nave'] = lambda: music('music_nave', 'underwater-theme-ii', 'Underwater Theme II.ogg', 0, None, 4, lu=-21)
SFX['sting_warden'] = lambda: build('sting_warden', [L('string-and-piano-horror-stings', 'abyss_0.ogg', fade=0.5)], fade=1.0, rev=(0.3, 2.4, 2500), lu=-12)

# Loops (ambience near a site).
SFX['amb_fire'] = lambda: loop('amb_fire', 'fireplace-sound-loop', 'fire.wav', 2, 12, lu=-22, hp=80)

if __name__ == '__main__':
    names = sys.argv[2:] or list(SFX)
    for n in names: SFX[n]()
