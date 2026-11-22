#!/usr/bin/env bash
# Round 182: the Doorkeeper's voice, made from the game's own sounds (no new pack):
#   roar_doorkeeper  three slow knocks on stone, then the Charnel King's roar a fifth lower
#   fall_doorkeeper  the Ossuarch's fall slowed, with stone breaking under it
set -euo pipefail
A="$(cd "$(dirname "$0")/.." && pwd)/assets/audio"
FF="ffmpeg -v error -y"
$FF -i "$A/mslam.mp3" -i "$A/mslam.mp3" -i "$A/mslam.mp3" -i "$A/roar_charnelKing.mp3" -filter_complex \
  "[0]asetrate=44100*0.62,aresample=44100,volume=1.4[k0];[1]asetrate=44100*0.6,aresample=44100,adelay=620|620,volume=1.4[k1];[2]asetrate=44100*0.58,aresample=44100,adelay=1240|1240,volume=1.6[k2];[3]asetrate=44100*0.72,aresample=44100,adelay=1900|1900[r];[k0][k1][k2][r]amix=inputs=4:normalize=0,afade=out:st=4.4:d=0.8,loudnorm=I=-16:TP=-1.5" \
  -t 5.2 -ar 44100 -b:a 96k "$A/roar_doorkeeper.mp3"
$FF -i "$A/fall_ossuarch.mp3" -i "$A/break.mp3" -filter_complex \
  "[0]asetrate=44100*0.8,aresample=44100[f];[1]asetrate=44100*0.7,aresample=44100,adelay=300|300,volume=1.2[b];[f][b]amix=inputs=2:normalize=0,afade=out:st=3.8:d=0.8,loudnorm=I=-17:TP=-1.5" \
  -t 4.6 -ar 44100 -b:a 96k "$A/fall_doorkeeper.mp3"
echo wrote roar_doorkeeper fall_doorkeeper
