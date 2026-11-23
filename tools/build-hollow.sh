#!/usr/bin/env bash
# Round 187: the Hollow Saint's voice, made from the game's own sounds (no new pack):
#   roar_hollowSaint  the cathedral choir played backwards and slowed, under the Saint's own cast a fifth down and the
#                     Cardinal's roar
#   fall_hollowSaint  ash blowing away, the sacrifice tone, and a shrine chime played backwards, rising
set -euo pipefail
A="$(cd "$(dirname "$0")/.." && pwd)/assets/audio"
FF="ffmpeg -v error -y"
$FF -i "$A/amb_choir.mp3" -i "$A/cast.mp3" -i "$A/roar_cardinal.mp3" -filter_complex \
  "[0]atrim=0:3.2,areverse,asetrate=44100*0.7,aresample=44100,afade=in:d=0.4,volume=1.2[c];[1]asetrate=44100*0.62,aresample=44100,volume=1.3[k];[2]asetrate=44100*0.82,aresample=44100,adelay=500|500,volume=0.9[r];[c][k][r]amix=inputs=3:normalize=0,afade=out:st=3.6:d=0.8,loudnorm=I=-16:TP=-1.5" \
  -t 4.4 -ar 44100 -b:a 96k "$A/roar_hollowSaint.mp3"
$FF -i "$A/ash.mp3" -i "$A/sacrifice.mp3" -i "$A/shrine.mp3" -filter_complex \
  "[0]asetrate=44100*0.8,aresample=44100,volume=1.2[a];[1]asetrate=44100*0.85,aresample=44100,adelay=400|400,volume=0.8[s];[2]areverse,asetrate=44100*0.9,aresample=44100,adelay=1200|1200,volume=0.9[h];[a][s][h]amix=inputs=3:normalize=0,afade=out:st=3.8:d=0.8,loudnorm=I=-17:TP=-1.5" \
  -t 4.6 -ar 44100 -b:a 96k "$A/fall_hollowSaint.mp3"
echo wrote roar_hollowSaint fall_hollowSaint
