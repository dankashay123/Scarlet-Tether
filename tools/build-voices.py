#!/usr/bin/env python3
# Builds the townsfolk's voice cries (round 157), synthesised here (no sample pack): a short wordless murmur that
# plays as a line of dialogue opens. Three registers; the game picks one per speaker and shifts its pitch a little.
#   voice_lo.mp3   a low "hm-mm" (men)
#   voice_mid.mp3  a middle "ah-ha"
#   voice_hi.mp3   a light "mm-hm" (women)
# Needs ffmpeg and numpy.  python3 tools/build-voices.py
import os, subprocess
import numpy as np
SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio')

def write(name, x, peak):
    x = x / np.abs(x).max() * peak
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '96k', os.path.join(OUT, name + '.mp3')], input=x.astype(np.float32).tobytes(), check=True)
    print('wrote', name)

def formant(x, f, bw):
    # a two-pole resonator: shapes a buzz into a vowel
    r = np.exp(-np.pi * bw / SR); c = 2 * r * np.cos(2 * np.pi * f / SR); y = np.zeros_like(x)
    for i in range(2, len(x)): y[i] = x[i] + c * y[i - 1] - r * r * y[i - 2]
    return y

def murmur(f0, sylls, vowel):
    # sylls: (start, length, pitch factor at start, at end); vowel: formant list
    ln = max(s + l for s, l, _, _ in sylls) + 0.05
    t = np.arange(int(SR * ln)) / SR
    f = np.zeros_like(t); amp = np.zeros_like(t)
    for st, l, a, b in sylls:
        u = t - st; on = (u >= 0) & (u < l)
        f = np.where(on, f0 * (a + (b - a) * np.clip(u / l, 0, 1)), f)
        amp = np.maximum(amp, np.where(on, np.sin(np.pi * np.clip(u / l, 0, 1)) ** 0.7, 0))
    ph = 2 * np.pi * np.cumsum(np.where(f > 0, f, f0)) / SR
    buzz = sum((0.85 ** h) * np.sin(h * ph) for h in range(1, 14))
    v = sum(g * formant(buzz, fr, bw) for fr, bw, g in vowel)
    v = v * amp
    # soften: a gentle low-pass by averaging
    k = 6; v = np.convolve(v, np.ones(k) / k, mode='same')
    return v

write('voice_lo', murmur(120, [(0.0, 0.16, 1.05, 0.98), (0.17, 0.2, 1.0, 0.86)], [(400, 90, 1.0), (900, 120, 0.35), (2400, 200, 0.08)]), 0.4)
write('voice_mid', murmur(175, [(0.0, 0.13, 1.0, 1.08), (0.15, 0.2, 1.1, 0.9)], [(700, 110, 1.0), (1200, 130, 0.5), (2600, 220, 0.1)]), 0.4)
write('voice_hi', murmur(250, [(0.0, 0.14, 1.04, 0.96), (0.15, 0.19, 1.08, 0.92)], [(450, 100, 1.0), (1100, 140, 0.4), (2800, 240, 0.1)]), 0.4)
