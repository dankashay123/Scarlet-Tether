#!/usr/bin/env python3
# Builds the battle pets' cues (round 137), synthesised here (no sample pack):
#   chirp.mp3  the Nail Finch: two quick falling whistles
#   bleat.mp3  the White Lamb: a soft wavering "meh"
#   puff.mp3   the Censer Mouse: a small breath of fire (filtered noise)
# Needs ffmpeg and numpy.  python3 tools/build-pets.py
import os, subprocess
import numpy as np
SR = 44100
rng = np.random.default_rng(11)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio')

def write(name, x, peak):
    x = x / np.abs(x).max() * peak
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '96k', os.path.join(OUT, name + '.mp3')], input=x.astype(np.float32).tobytes(), check=True)
    print('wrote', name)

def env(t, a, d):
    return np.minimum(1, t / a) * np.exp(-d * t)

# chirp: two whistles sweeping down, the second shorter
t = np.arange(int(SR * 0.22)) / SR
x = np.zeros_like(t)
for st, f0, f1, ln in [(0.0, 4200, 2900, 0.07), (0.09, 4600, 3300, 0.05)]:
    u = t - st; on = (u >= 0) & (u < ln)
    f = f0 + (f1 - f0) * np.clip(u / ln, 0, 1)
    ph = 2 * np.pi * np.cumsum(np.where(on, f, 0)) / SR
    x += np.where(on, np.sin(ph) * np.sin(np.pi * np.clip(u / ln, 0, 1)), 0)
write('chirp', x, 0.45)

# bleat: a voiced tone near 420 Hz with a quick tremolo, a few harmonics shaped like an open vowel
t = np.arange(int(SR * 0.42)) / SR
f = 420 * (1 + 0.04 * np.sin(2 * np.pi * 5 * t)) * (1 - 0.08 * t)
ph = 2 * np.pi * np.cumsum(f) / SR
x = np.zeros_like(t)
for h, a in [(1, 1.0), (2, 0.7), (3, 0.55), (4, 0.25), (5, 0.12), (6, 0.06)]:
    x += a * np.sin(h * ph)
x *= 1 - 0.55 * (0.5 + 0.5 * np.sin(2 * np.pi * 24 * t))       # the bleat's flutter
x *= np.minimum(1, t / 0.03) * np.minimum(1, (t[-1] - t) / 0.12)
write('bleat', x, 0.4)

# puff: noise through a soft low-pass, fast swell and fall, with a little crackle
t = np.arange(int(SR * 0.3)) / SR
n = rng.standard_normal(len(t))
y = np.zeros_like(n); a = 0.08
for i in range(1, len(n)): y[i] = y[i - 1] + a * (n[i] - y[i - 1])
y *= env(t, 0.03, 11)
cr = (rng.random(len(t)) < 0.0015) * rng.standard_normal(len(t)) * 2.5 * np.exp(-8 * t)
write('puff', y + cr * 0.15, 0.45)
