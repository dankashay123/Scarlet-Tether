#!/usr/bin/env python3
# Builds assets/audio/buff.mp3: a soft rising two-note shimmer played when a
# buff icon appears (round 136). Synthesised here (no sample pack): two bell
# tones a fifth apart with gentle harmonics and a short tail. Needs ffmpeg and
# numpy.  python3 tools/build-buff.py
import os, subprocess
import numpy as np
SR = 44100
t = np.arange(int(SR * 0.42)) / SR
x = np.zeros_like(t)
for start, f0 in [(0.0, 988.0), (0.07, 1480.0)]:
    u = t - start
    on = u >= 0
    v = np.zeros_like(t)
    for h, a, d in [(1, 1.0, 9), (2, 0.32, 14), (3, 0.12, 22), (4.2, 0.06, 30)]:
        v += a * np.sin(2 * np.pi * f0 * h * u) * np.exp(-d * u)
    v *= np.minimum(1, np.maximum(0, u) / 0.004)               # soft attack
    x += np.where(on, v, 0) * (0.8 if start else 0.6)
x *= np.minimum(1, (t[-1] - t) / 0.06)                       # fade the tail
x = x / np.abs(x).max() * 0.5
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio', 'buff.mp3')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '96k', out], input=x.astype(np.float32).tobytes(), check=True)
print('wrote', out)
