"""Build the raffle's sound sprite: public/sounds/sprite.mp3 + lib/sound-sprite.js.

Every sound is public domain (CC0) — see public/sounds/CREDITS.md. The script
downloads the sources into .sound-cache/, cuts each clip, cleans it up
(rumble filter, short fades, peak normalisation) and joins them with silence
into one small MP3 so the browser fetches and decodes a single file.

Requires Python 3 with numpy + scipy, and ffmpeg on PATH (or FFMPEG=...).

    python scripts/build-sounds.py
"""
import hashlib
import io
import json
import os
import shutil
import subprocess
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".sound-cache"
OUT_MP3 = ROOT / "public" / "sounds" / "sprite.mp3"
OUT_JS = ROOT / "lib" / "sound-sprite.js"
FFMPEG = os.environ.get("FFMPEG") or shutil.which("ffmpeg") or "ffmpeg"
SR = 44100
GAP = 0.15  # silence between clips
SLACK = 0.03  # extra read past each clip (absorbs MP3 decoder-delay differences)
KENNEY_ZIP = "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip"

# name, source, where
#   source "bsb:NNNN"   -> https://bigsoundbank.com sound #NNNN
#   source "kenney:X"   -> Kenney Impact Sounds, Audio/X.ogg (whole file, trimmed)
#   where  ("event", t) -> the vocal event nearest t seconds
#          ("range", a, b) -> exactly a..b seconds
#          ("range", a, b, fade) -> a..b seconds, fading out over the last `fade` seconds
CLIPS = [
    # Barks: a small dog, recorded clean (0612 "Small dog barking")
    ("bark1", "bsb:0612", ("event", 9.29)),
    ("bark2", "bsb:0612", ("event", 18.85)),
    ("bark3", "bsb:0612", ("event", 25.44)),
    ("bark4", "bsb:0612", ("event", 13.26)),
    ("bark5", "bsb:0612", ("event", 0.15)),
    # Quick yips (1060 "2 small dogs bark and growl")
    ("yip1", "bsb:1060", ("event", 2.20)),
    ("yip2", "bsb:1060", ("event", 2.90)),
    ("yip3", "bsb:1060", ("event", 3.48)),
    ("yip4", "bsb:1060", ("event", 4.61)),
    ("yip5", "bsb:1060", ("event", 7.21)),
    # Lower "woof"s (1545 / 1544 "Dogs barking and crying")
    ("woof1", "bsb:1545", ("event", 0.91)),
    ("woof2", "bsb:1544", ("event", 0.77)),
    # Whines (1546 "Dogs barking and crying #3") — tonal, questioning
    ("whine1", "bsb:1546", ("event", 12.75)),
    ("whine2", "bsb:1546", ("event", 8.53)),
    ("whine3", "bsb:1546", ("event", 5.27)),
    # Howl (2450 "Dog singing #1")
    ("howl", "bsb:2450", ("event", 0.12)),
    # Happy panting (1547 "Dogs Breathing")
    ("pant", "bsb:1547", ("range", 2.35, 5.5, 1.4)),
    # Bones: wooden clacks (Kenney)
    ("clack1", "kenney:impactWood_light_000", None),
    ("clack2", "kenney:impactWood_light_001", None),
    ("clack3", "kenney:impactWood_light_002", None),
    ("clack4", "kenney:impactWood_light_003", None),
    ("clack5", "kenney:impactWood_light_004", None),
    ("plank1", "kenney:impactPlank_medium_000", None),
    ("plank2", "kenney:impactPlank_medium_004", None),
    # Paws (Kenney carpet footsteps: soft and short)
    ("paw1", "kenney:footstep_carpet_000", None),
    ("paw2", "kenney:footstep_carpet_001", None),
    ("paw3", "kenney:footstep_carpet_003", None),
    # Landings
    ("thud", "kenney:impactSoft_medium_001", None),
    ("thudHeavy", "kenney:impactSoft_heavy_002", None),
    # Holiday: sleigh bells (1124 "Bells of Santa Claus 2"), seven steady shakes
    ("sleighbells", "bsb:1124", ("range", 4.57, 9.22)),
    # New Year: a champagne cork (0648) and party horns (1553 a short toot, 1557 a longer one)
    ("cork", "bsb:0648", ("range", 0.2, 0.62)),
    ("horn1", "bsb:1553", ("event", 0.3)),
    ("horn2", "bsb:1557", ("event", 0.6)),
    # Spring: a blackbird (3503 "Common blackbird #30") and a second one answering (3496, #23)
    ("bird1", "bsb:3503", ("range", 0.5, 3.15)),
    ("bird2", "bsb:3496", ("range", 0.9, 2.24)),
    # Halloween: rolling thunder (3113 "Thunder #2")
    ("thunder", "bsb:3113", ("range", 0.95, 4.4, 0.8)),
    # Autumn: two steps through dry leaves (2889 "Feet in leaves #2")
    ("leaves", "bsb:2889", ("range", 1.1, 3.0, 0.4)),
]

# Clips whose hiss is softened with a lowpass (Hz).
LOWPASS = {"leaves": 6500}


def fetch(url, dest):
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        dest.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    return dest


def source_file(source):
    kind, name = source.split(":")
    if kind == "bsb":
        return fetch(f"https://bigsoundbank.com/UPLOAD/ogg/{name}.ogg", CACHE / "bsb" / f"{name}.ogg")
    zpath = fetch(KENNEY_ZIP, CACHE / "kenney_impact-sounds.zip")
    out = CACHE / "kenney" / f"{name}.ogg"
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zpath) as z:
            out.write_bytes(z.read(f"Audio/{name}.ogg"))
    return out


def decode(path):
    raw = subprocess.run(
        [FFMPEG, "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def find_event(x, t):
    """Bounds (samples) of the loud event nearest time t, on 5 ms frames."""
    hop = int(SR * 0.005)
    frames = x[: len(x) // hop * hop].reshape(-1, hop)
    rms = np.sqrt((frames**2).mean(axis=1))
    floor = np.percentile(rms, 15)
    active = rms > max(floor * 10 ** (15 / 20), 10 ** (-40 / 20))
    i = int(round(t / 0.005))
    idx = np.where(active)[0]
    i = int(idx[np.argmin(np.abs(idx - i))])
    s = i
    while s > 0 and (active[s - 1] or active[max(0, s - 8) : s].any()):
        s -= 1
    e = i
    while e < len(active) - 1 and (active[e + 1] or active[e + 1 : e + 9].any()):
        e += 1
    return s * hop, (e + 1) * hop


def trim_tail(x, db=-50):
    thr = np.abs(x).max() * 10 ** (db / 20)
    idx = np.where(np.abs(x) > thr)[0]
    return x[idx[0] : idx[-1] + int(0.02 * SR)] if len(idx) else x


def clean(x, dog):
    if dog:
        x = sosfilt(butter(2, 70, "highpass", fs=SR, output="sos"), x)
    fi, fo = int(0.003 * SR), int(0.025 * SR)
    x = x.copy()
    x[:fi] *= np.linspace(0, 1, fi)
    x[-fo:] *= np.linspace(1, 0, fo)
    return x / (np.abs(x).max() + 1e-12) * 10 ** (-1 / 20)  # peak -1 dBFS


def build():
    parts, clips, pos = [np.zeros(int(0.05 * SR))], {}, 0.05
    for name, source, where in CLIPS:
        x = decode(source_file(source))
        dog = source.startswith("bsb:")
        if where is None:
            seg = trim_tail(x)
        elif where[0] == "range":
            seg = x[int(where[1] * SR) : int(where[2] * SR)].copy()
            if len(where) > 3:
                n = int(where[3] * SR)
                seg[-n:] *= np.linspace(1, 0, n) ** 2
        else:
            s, e = find_event(x, where[1])
            seg = x[max(0, s - int(0.015 * SR)) : min(len(x), e + int(0.06 * SR))]
        if name in LOWPASS:
            seg = sosfilt(butter(4, LOWPASS[name], "lowpass", fs=SR, output="sos"), seg)
        seg = clean(seg, dog)
        dur = len(seg) / SR
        clips[name] = [round(pos, 4), round(dur + SLACK, 4)]
        parts += [seg, np.zeros(int(GAP * SR))]
        pos += dur + GAP
        print(f"  {name:10s} {source:32s} {dur:5.2f}s")
    pcm = np.concatenate(parts).astype(np.float32)
    OUT_MP3.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [FFMPEG, "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
         "-codec:a", "libmp3lame", "-b:a", "64k", str(OUT_MP3)],
        input=pcm.tobytes(),
        check=True,
    )
    digest = hashlib.sha1(OUT_MP3.read_bytes()).hexdigest()[:10]
    OUT_JS.write_text(
        "// Generated by scripts/build-sounds.py — do not edit by hand.\n"
        "// Clip positions in public/sounds/sprite.mp3: [start seconds, duration seconds].\n"
        f"export const SPRITE_URL = \"/sounds/sprite.mp3?v={digest}\";\n\n"
        f"export const SPRITE_CLIPS = {json.dumps(clips, indent=2)};\n",
        encoding="utf-8",
    )
    print(f"\n{len(clips)} clips, {len(pcm) / SR:.1f}s, {OUT_MP3.stat().st_size / 1024:.0f} KB -> {OUT_MP3.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
