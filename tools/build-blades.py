#!/usr/bin/env python3
# Builds the Vesper's blade sounds (round 122) into assets/audio/:
#   slash  a quick cut through the air: noise through a band-pass that sweeps up, a thin edge of ring
#   shing  a blade's ring: inharmonic partials with a fast attack (crits, the daggers taking off)
#   stab   a blade landing: a short dull thump and a click
#   whirl  a spin of blades: a longer whoosh whose band rises and falls twice
# Synthesised here (no sample pack). Needs ffmpeg and numpy.  python3 tools/build-blades.py
import os, subprocess
import numpy as np
SR = 44100
rng = np.random.default_rng(11)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio')

def bandpass(x, fc, q):
    # A two-pole resonator whose centre follows fc (one value per sample).
    y = np.zeros_like(x); y1 = y2 = 0.0
    for i in range(len(x)):
        w = 2 * np.pi * fc[i] / SR; r = 1 - w / (2 * q)
        a1, a2 = 2 * r * np.cos(w), -r * r
        v = (1 - r) * x[i] + a1 * y1 + a2 * y2
        y2, y1 = y1, v; y[i] = v
    return y

def env(t, att, dec):
    return np.minimum(1, t / att) * np.exp(-t / dec)

def finish(x, name, peak=0.7):
    x = x * np.minimum(1, (len(x) - 1 - np.arange(len(x))) / (SR * 0.02))
    x = x / (np.abs(x).max() or 1) * peak
    out = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '96k', out], input=x.astype(np.float32).tobytes(), check=True)
    print('wrote', out)

def partials(t, fs, decay):
    return sum(a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-d * t) for f, a, d in fs)

# slash: 0.2 s, the band sweeping 900 -> 5200 Hz, the edge of a ring at the end.
t = np.arange(int(SR * 0.2)) / SR
fc = 900 + 4300 * (t / t[-1]) ** 1.6
x = bandpass(rng.standard_normal(len(t)), fc, 2.2) * env(t, 0.03, 0.06)
x += 0.15 * partials(np.maximum(0, t - 0.05), [(5200, 1, 50), (7400, 0.6, 70)], 0) * (t > 0.05)
finish(x, 'slash', 0.65)

# shing: 0.45 s of ring.
t = np.arange(int(SR * 0.45)) / SR
x = partials(t, [(2870, 1.0, 9), (2893, 0.7, 9), (4410, 0.6, 13), (6230, 0.45, 18), (8150, 0.25, 26), (10400, 0.12, 40)], 0)
x += 0.5 * rng.standard_normal(len(t)) * np.exp(-700 * t)
x *= np.minimum(1, t / 0.001)
finish(x, 'shing', 0.5)

# stab: 0.12 s, a low thump and a click.
t = np.arange(int(SR * 0.12)) / SR
x = bandpass(rng.standard_normal(len(t)), np.full(len(t), 420.0), 1.4) * env(t, 0.002, 0.025) * 2.2
x += 0.6 * bandpass(rng.standard_normal(len(t)), np.full(len(t), 3200.0), 3) * env(t, 0.001, 0.006)
finish(x, 'stab', 0.7)

# whirl: 0.55 s, the band going up and down twice as the blades go round.
t = np.arange(int(SR * 0.55)) / SR
fc = 1100 + 2600 * (0.5 - 0.5 * np.cos(2 * np.pi * 2 * t / t[-1]))
x = bandpass(rng.standard_normal(len(t)), fc, 1.8) * np.sin(np.pi * t / t[-1]) ** 0.7
finish(x, 'whirl', 0.6)
