#!/usr/bin/env python3
# Builds assets/audio/sacrifice.mp3: seven Wounds breaking, then the mythic one landing.
# Synthesised here (no sample pack): seven short cracks falling in pitch, then a low
# bell with a swell under it. Needs ffmpeg and numpy.  python3 tools/build-sacrifice.py
import os, subprocess
import numpy as np
SR = 44100
t = np.arange(int(SR * 1.9)) / SR
x = np.zeros_like(t)
rng = np.random.default_rng(11)
for k in range(7):                                           # the cracks, one per rank given up
    t0 = 0.05 + k * 0.1; u = np.maximum(0, t - t0); on = (t >= t0)
    f = 1900 * 0.88 ** k
    x += on * 0.5 * np.sin(2 * np.pi * f * u) * np.exp(-38 * u)
    x += on * 0.3 * np.sin(2 * np.pi * f * 2.76 * u) * np.exp(-55 * u)
    x += on * 0.45 * rng.standard_normal(len(t)) * np.exp(-420 * u)
t0 = 0.8; u = np.maximum(0, t - t0); on = (t >= t0)          # the mythic Wound: a low bell
for f, a, d in [(196, 1.0, 3.2), (294, 0.5, 4), (392.5, 0.6, 4.5), (588, 0.3, 6), (1176, 0.12, 9)]:
    x += on * a * 0.6 * np.sin(2 * np.pi * f * u) * np.exp(-d * u)
x += on * 0.5 * np.sin(2 * np.pi * 65 * u) * np.exp(-5 * u) * np.minimum(1, u / 0.02)  # the weight under it
x *= np.minimum(1, t / 0.003) * np.minimum(1, (t[-1] - t) / 0.15)
x = x / np.abs(x).max() * 0.8
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio', 'sacrifice.mp3')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '96k', out], input=x.astype(np.float32).tobytes(), check=True)
print('wrote', out)
