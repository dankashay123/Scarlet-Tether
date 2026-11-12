#!/usr/bin/env python3
# Builds assets/audio/chime.mp3: the glass ping of the Anchoress's shards.
# Synthesised here (no sample pack): a few inharmonic partials with a fast
# decay and a short click. Needs ffmpeg and numpy.  python3 tools/build-chime.py
import os, subprocess
import numpy as np
SR = 44100
t = np.arange(int(SR * 0.3)) / SR
x = np.zeros_like(t)
for f, a, d in [(2350, 1.0, 26), (3720, 0.6, 34), (5480, 0.4, 44), (7100, 0.22, 60), (9300, 0.1, 80)]:
    x += a * np.sin(2 * np.pi * f * t) * np.exp(-d * t)
rng = np.random.default_rng(7)
x += 0.35 * rng.standard_normal(len(t)) * np.exp(-900 * t)   # the tap
x *= np.minimum(1, t / 0.002)                                # no click at the start
x *= np.minimum(1, (t[-1] - t) / 0.03)                       # fade the tail
x = x / np.abs(x).max() * 0.7
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio', 'chime.mp3')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '96k', out], input=x.astype(np.float32).tobytes(), check=True)
print('wrote', out)
