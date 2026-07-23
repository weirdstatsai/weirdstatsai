#!/usr/bin/env python3
"""
STP walking-skeleton POC #1 — live microphone -> plain text captions, fully local.

Run this ON YOUR MAC. Talk into the mic; transcribed text prints to the terminal.

        audio in  ->  (skip silence)  ->  local Whisper model  ->  plain text out

v2 adds a tiny "Module 2" (audio pre-processing): it skips near-silent windows and
enables Whisper's built-in voice-activity filter. That kills the silence-driven
"hallucinated" words and the divide-by-zero warnings from v1.
"""

import sys
import queue
import warnings
import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel

warnings.filterwarnings("ignore")   # hide the harmless matmul warnings on quiet audio

# ---- knobs -------------------------------------------------------------------
SAMPLE_RATE = 16000        # Whisper expects 16 kHz mono
WINDOW_SECONDS = 5         # transcribe every N seconds (crude; true streaming is later)
MODEL_SIZE = "base.en"     # "tiny.en" | "base.en" | "small.en" (small.en = more accurate)
INPUT_DEVICE = None        # None = default mic; a device number = mixer/interface
SILENCE_RMS = 0.005        # windows quieter than this are treated as silence and skipped
# -----------------------------------------------------------------------------

audio_q: "queue.Queue[np.ndarray]" = queue.Queue()


def on_audio(indata, frames, time_info, status):
    if status:
        print(status, file=sys.stderr)
    audio_q.put(indata[:, 0].copy())


if "--list-devices" in sys.argv:
    print(sd.query_devices())
    sys.exit(0)

print(f"Loading Whisper '{MODEL_SIZE}' (first run downloads it, then offline)...")
model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
print("Ready. Start talking. Press Ctrl+C to stop.\n")

buffer = np.empty(0, dtype=np.float32)
window_samples = WINDOW_SECONDS * SAMPLE_RATE

with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32",
                    device=INPUT_DEVICE, callback=on_audio):
    try:
        while True:
            buffer = np.concatenate([buffer, audio_q.get()])
            if len(buffer) >= window_samples:
                # --- tiny Module 2: only transcribe if the window actually has sound ---
                loudness = float(np.sqrt(np.mean(buffer ** 2)))
                if loudness >= SILENCE_RMS:
                    segments, _ = model.transcribe(buffer, language="en", vad_filter=True)
                    text = " ".join(s.text.strip() for s in segments).strip()
                    if text:
                        print(text)
                buffer = np.empty(0, dtype=np.float32)
    except KeyboardInterrupt:
        print("\nStopped.")
