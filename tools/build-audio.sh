#!/usr/bin/env bash
# Builds assets/audio/*.mp3 from the free packs listed in docs/CREDITS.md.
# The source packs are not committed. Download them, unzip each Kenney pack
# into <src>/kenney/<pack-name>/, put the OpenGameArt files in <src>/oga/,
# then run:  tools/build-audio.sh <src>
set -euo pipefail
SRC=${1:?usage: tools/build-audio.sh <src>}
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets/audio"
mkdir -p "$OUT"
K="$SRC/kenney"
k() { find "$K/$1" -name "$2" | head -1; }
FF="ffmpeg -v error -y"
# One effect: mono, trimmed of silence, normalised, 96 kbps.
sfx() { # name filter input [input...]
  local name=$1 filt=$2; shift 2
  local ins=() n=0; for f in "$@"; do ins+=(-i "$f"); n=$((n+1)); done
  local mix; if [ $n -gt 1 ]; then mix="amix=inputs=$n:normalize=0,"; else mix=""; fi
  local tmp; tmp=$(mktemp --suffix=.wav)
  $FF "${ins[@]}" -filter_complex "${mix}${filt}silenceremove=start_periods=1:start_threshold=-50dB,aformat=channel_layouts=mono" -ar 44100 "$tmp"
  # Peak-normalise to -3 dB (loudnorm overshoots on very short clips).
  local peak; peak=$(ffmpeg -v info -i "$tmp" -af volumedetect -f null - 2>&1 | grep -oE 'max_volume: [-0-9.]+' | grep -oE '[-0-9.]+$')
  $FF -i "$tmp" -af "volume=$(echo "-3 - ($peak)" | bc)dB" -b:a 96k "$OUT/$name.mp3"
  rm -f "$tmp"
}
# A seamless loop: the last X seconds are crossfaded into the start.
loop() { # name input start length xfade bitrate extra-filter
  local name=$1 in=$2 ss=$3 len=$4 x=$5 br=$6 pre=${7:-anull}
  $FF -ss "$ss" -t "$(echo "$len + $x" | bc)" -i "$in" -filter_complex \
    "[0]$pre,asplit=3[a][b][c];[a]atrim=$x:$len,asetpts=PTS-STARTPTS[body];[b]atrim=$len:$(echo "$len + $x" | bc),asetpts=PTS-STARTPTS,afade=out:d=$x[tail];[c]atrim=0:$x,asetpts=PTS-STARTPTS,afade=in:d=$x[head];[tail][head]amix=inputs=2:normalize=0[seam];[seam][body]concat=n=2:v=0:a=1,loudnorm=I=-20:TP=-2" \
    -ar 44100 -b:a "$br" "$OUT/$name.mp3"
}

# --- combat ---
sfx shoot "volume=1," "$(k rpg-audio metalClick.ogg)" "$(k impact-sounds impactWood_light_002.ogg)"
for i in 0 1 2; do sfx hit$i "atrim=0:0.35," "$(k impact-sounds impactPunch_medium_00$i.ogg)"; done
sfx block "atrim=0:0.4," "$(k impact-sounds impactMetal_light_001.ogg)"
for i in 0 1; do sfx kill$i "atrim=0:0.6," "$(k impact-sounds impactPunch_heavy_00$i.ogg)" "$(k impact-sounds impactSoft_heavy_00$i.ogg)"; done
sfx hurt "asetrate=44100*0.8,aresample=44100,atrim=0:0.5," "$(k impact-sounds impactPunch_heavy_003.ogg)"
sfx execute "atrim=0:0.8," "$(k impact-sounds impactPunch_heavy_004.ogg)" "$(k rpg-audio knifeSlice.ogg)"
sfx break "atrim=0:0.6," "$(k impact-sounds impactWood_heavy_001.ogg)" "$(k impact-sounds impactPlate_light_002.ogg)"
sfx perfect "asetrate=44100*1.5,aresample=44100,atrim=0:1.2,afade=out:st=0.5:d=0.7," "$(k interface-sounds glass_002.ogg)" "$(k impact-sounds impactBell_heavy_001.ogg)"
# --- miracles ---
sfx thurible "volume=0.8,atrim=0:0.5," "$(k impact-sounds impactMetal_medium_001.ogg)"
sfx flask "atrim=0:0.9," "$(k impact-sounds impactGlass_medium_000.ogg)" "$(k sci-fi-sounds slime_000.ogg)"
sfx chain "atrim=0:0.7," "$(k rpg-audio metalLatch.ogg)" "$(k impact-sounds impactMetal_light_003.ogg)"
sfx penance "asetrate=44100*0.9,aresample=44100,atrim=0:2.2,afade=out:st=1.4:d=0.8," "$(k impact-sounds impactBell_heavy_000.ogg)"
# --- the world ---
sfx gate_lock "atrim=0:1," "$(k impact-sounds impactMetal_heavy_000.ogg)" "$(k rpg-audio doorClose_4.ogg)"
sfx gate_open "atrim=0:1.2," "$(k rpg-audio doorOpen_1.ogg)" "$(k rpg-audio creak1.ogg)"
sfx pickup "" "$(k interface-sounds pluck_001.ogg)"
sfx heal "" "$(k interface-sounds confirmation_001.ogg)"
sfx gold "atrim=0:0.6," "$(k casino-audio chips-handle-1.ogg)"
sfx shrine "atrim=0:2.4,afade=out:st=1.6:d=0.8," "$(k impact-sounds impactBell_heavy_002.ogg)" "$(k interface-sounds glass_005.ogg)"
sfx chest "atrim=0:1.2," "$(k rpg-audio doorOpen_2.ogg)" "$(k rpg-audio handleCoins2.ogg)"
sfx elite "asetrate=44100*0.62,aresample=44100,atrim=0:2.6,afade=out:st=1.8:d=0.8," "$(k impact-sounds impactBell_heavy_004.ogg)" "$(k sci-fi-sounds lowFrequency_explosion_000.ogg)"
sfx death "asetrate=44100*0.7,aresample=44100,atrim=0:2.4,afade=out:st=1.4:d=1," "$(k impact-sounds impactBell_heavy_003.ogg)" "$(k sci-fi-sounds lowFrequency_explosion_001.ogg)"
sfx tap "" "$(k interface-sounds click_002.ogg)"

# --- music and ambience ---
O="$SRC/oga"
loop music_town "$O/dark_castle_-_part1.wav" 0 90 4 96k
loop music_dungeon "$O/dungeon002_0.ogg" 0 196 6 96k
loop amb_town "$O/wind%20background%20noise%202.wav" 4 28 2 64k "lowpass=f=2400,aformat=channel_layouts=mono"
loop amb_crickets "$O/crickets_1.mp3" 0 10 1.2 48k "highpass=f=1500,aformat=channel_layouts=mono"
ls -la "$OUT"
