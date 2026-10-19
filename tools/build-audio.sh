#!/usr/bin/env bash
# Builds the music and ambience loops in assets/audio from the tracks in
# docs/CREDITS.md. The sources are not committed: put the OpenGameArt files
# in <src>/oga/, then run:  tools/build-audio.sh <src>
# Sound effects (and the fire loop) come from tools/build-sfx.py.
set -euo pipefail
SRC=${1:?usage: tools/build-audio.sh <src>}
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets/audio"
mkdir -p "$OUT"
FF="ffmpeg -v error -y"
# A seamless loop: the last X seconds are crossfaded into the start.
loop() { # name input start length xfade bitrate extra-filter
  local name=$1 in=$2 ss=$3 len=$4 x=$5 br=$6 pre=${7:-anull}
  $FF -ss "$ss" -t "$(echo "$len + $x" | bc)" -i "$in" -filter_complex \
    "[0]$pre,asplit=3[a][b][c];[a]atrim=$x:$len,asetpts=PTS-STARTPTS[body];[b]atrim=$len:$(echo "$len + $x" | bc),asetpts=PTS-STARTPTS,afade=out:d=$x[tail];[c]atrim=0:$x,asetpts=PTS-STARTPTS,afade=in:d=$x[head];[tail][head]amix=inputs=2:normalize=0[seam];[seam][body]concat=n=2:v=0:a=1,loudnorm=I=-20:TP=-2" \
    -ar 44100 -b:a "$br" "$OUT/$name.mp3"
}

# --- music and ambience ---
O="$SRC/oga"
# The Bleeding Vigil's music (Vael and the strata: tools/build-sfx.py).
loop music_dungeon "$O/dungeon002_0.ogg" 0 196 6 96k
loop amb_town "$O/wind%20background%20noise%202.wav" 4 28 2 64k "lowpass=f=2400,aformat=channel_layouts=mono"
loop amb_crickets "$O/crickets_1.mp3" 0 10 1.2 48k "highpass=f=1500,aformat=channel_layouts=mono"
ls -la "$OUT"
