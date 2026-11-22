#!/usr/bin/env python3
# Builds the weather sounds in assets/audio (round 179). Synthesised here, no sample pack:
#   amb_rain.mp3  a seamless 20 s loop of steady rain: filtered noise for the hiss plus scattered drops
#   thunder.mp3   a clap and a long rolling rumble, for lightning in a moor storm
#   amb_embers.mp3 a 16 s loop of soft crackle for the Ashfields' ember storm
# Needs ffmpeg and numpy.  python3 tools/build-weather.py
import os, subprocess
import numpy as np
SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio')
rng = np.random.default_rng(179)

def lp(x, f):  # one-pole low pass, vectorised by blocks through lfilter-like recursion
    k = np.exp(-2 * np.pi * f / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s = (1 - k) * x[i] + k * s; y[i] = s
    return y

def bp(x, lo, hi): return lp(x - lp(x, lo), hi)

def loop_seam(x, xf):
    n = int(xf * SR); body = x[:-n].copy(); tail = x[-n:]; r = np.linspace(0, 1, n)
    body[:n] = body[:n] * r + tail * (1 - r)
    return body

def write(name, x, br='64k', peak=0.7, stereo=False):
    x = x / (np.abs(x).max() + 1e-9) * peak
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', 'loudnorm=I=-24:TP=-3' if name.startswith('amb') else 'anull', '-ar', str(SR), '-b:a', br, os.path.join(OUT, f'{name}.mp3')], input=x.astype(np.float32).tobytes(), check=True)
    print('wrote', name)

def rain(secs=20, xf=2.0):
    n = int((secs + xf) * SR); w = rng.standard_normal(n)
    hiss = bp(w, 900, 6000) * 0.5 + lp(w, 500) * 0.25
    hiss *= 1 + 0.15 * np.sin(2 * np.pi * np.arange(n) / SR * 0.13)
    drops = np.zeros(n)
    for _ in range(int(secs * 70)):
        at = rng.integers(0, n - 2000); f = rng.uniform(1800, 4200); L = int(SR * rng.uniform(0.008, 0.03)); t = np.arange(L) / SR
        drops[at:at + L] += rng.uniform(0.2, 1) * np.sin(2 * np.pi * f * t * (1 - t * 8)) * np.exp(-t * rng.uniform(120, 260))
    return loop_seam(hiss + drops * 0.35, xf)

def thunder(secs=5.5):
    n = int(secs * SR); t = np.arange(n) / SR; w = rng.standard_normal(n)
    clap = bp(w, 200, 3000) * np.exp(-t * 9) * 1.2
    roll = lp(lp(w, 160), 120) * 6 * np.minimum(1, t / 0.15) * np.exp(-t * 0.8) * (1 + 0.6 * np.sin(2 * np.pi * t * 1.7) * np.sin(2 * np.pi * t * 0.6))
    x = clap + roll
    x *= np.minimum(1, (t[-1] - t) / 0.5)
    return x

def embers(secs=16, xf=1.5):
    n = int((secs + xf) * SR); w = rng.standard_normal(n)
    x = lp(w, 300) * 0.4
    for _ in range(int(secs * 40)):
        at = rng.integers(0, n - 500); L = rng.integers(20, 200)
        x[at:at + L] += rng.standard_normal(L) * rng.uniform(0.2, 1) * np.exp(-np.arange(L) / (L / 4))
    return loop_seam(x - lp(x, 60), xf)

write('amb_rain', rain())
write('thunder', thunder(), br='96k', peak=0.85)
write('amb_embers', embers())
