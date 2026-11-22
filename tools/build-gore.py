#!/usr/bin/env python3
# Builds the gore sounds in assets/audio (round 180). Synthesised here, no sample pack:
#   splat.mp3    a wet burst: a low thump under a short band of noise, then a few drips
#   clatter.mp3  bones hitting stone: hollow clicks that bounce and thin out
#   pop.mp3      a bile sac bursting: a rising bubble and a wet tail
# Needs ffmpeg and numpy.  python3 tools/build-gore.py
import os, subprocess
import numpy as np
SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio')
rng = np.random.default_rng(180)

def lp(x, f):
    k = np.exp(-2 * np.pi * f / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s = (1 - k) * x[i] + k * s; y[i] = s
    return y
def bp(x, lo, hi): return lp(x - lp(x, lo), hi)
def reso(f, q, n):  # a decaying resonance, the body of a click
    t = np.arange(n) / SR; return np.sin(2 * np.pi * f * t) * np.exp(-t * f / q)

def write(name, x, peak=0.8):
    x = x / (np.abs(x).max() + 1e-9) * peak
    x[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR)); x[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '96k', os.path.join(OUT, f'{name}.mp3')], input=x.astype(np.float32).tobytes(), check=True)
    print('wrote', name)

def splat():
    n = int(0.45 * SR); t = np.arange(n) / SR; w = rng.standard_normal(n)
    body = bp(w, 250, 2200) * np.exp(-t * 26) * (1 + 0.5 * np.sin(2 * np.pi * 38 * t))
    thump = np.sin(2 * np.pi * (95 - 50 * t) * t) * np.exp(-t * 22) * 0.9
    x = body + thump
    for d in rng.uniform(0.08, 0.32, 5):
        i = int(d * SR); L = int(0.03 * SR); f = rng.uniform(900, 1800); tt = np.arange(L) / SR
        x[i:i + L] += 0.18 * np.sin(2 * np.pi * f * tt * (1 + tt * 12)) * np.exp(-tt * 140)
    return x

def clatter():
    n = int(0.6 * SR); x = np.zeros(n); at = 0.0
    for k in range(9):
        i = int(at * SR); L = int(0.05 * SR)
        if i + L >= n: break
        f = rng.uniform(1300, 2600); x[i:i + L] += (0.9 ** k) * (reso(f, 9, L) + 0.5 * reso(f * 1.53, 7, L) + 0.3 * rng.standard_normal(L) * np.exp(-np.arange(L) / SR * 400))
        at += rng.uniform(0.025, 0.07) * (1 + k * 0.12)
    return x

def pop():
    n = int(0.4 * SR); t = np.arange(n) / SR; w = rng.standard_normal(n)
    bub = np.sin(2 * np.pi * (180 * t + 2400 * t * t)) * np.exp(-t * 30) * (t < 0.12)
    burst = bp(w, 400, 3000) * np.exp(-((t - 0.07) * 40) ** 2) * 0.8
    tail = bp(w, 200, 1200) * np.exp(-t * 9) * 0.25
    return bub + burst + tail

write('splat', splat())
write('clatter', clatter(), peak=0.7)
write('pop', pop())
