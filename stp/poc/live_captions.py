#!/usr/bin/env python3
"""
STP walking-skeleton POC #1 — live microphone -> plain text captions, fully local.

Run this ON YOUR MAC (not in the cloud session). Talk into the mic and the
transcribed text prints to the terminal. This proves the core pipeline:

        audio in  ->  local speech model  ->  plain text out

Model: faster-whisper (OpenAI Whisper, running locally on your machine).
The FIRST run downloads the model once (needs internet); after that it works
100% offline — which is exactly the church requirement.

This version is deliberately crude: it transcribes in fixed ~5-second windows,
so you talk, pause, and see the text. Low latency / true streaming comes in a
later iteration. Right now we only want to prove the pipe works on your hardware.
"""

import sys
import queue
import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel

# ---- knobs you can play with -------------------------------------------------
SAMPLE_RATE = 16000        # Whisper expects 16 kHz mono audio
WINDOW_SECONDS = 5         # transcribe every N seconds of speech (crude, on purpose)
MODEL_SIZE = "base.en"     # "tiny.en" = fastest | "base.en" = balanced | "small.en" = most accurate
INPUT_DEVICE = None        # None = system default input. Set to a device index to use the mixer.
# -----------------------------------------------------------------------------

audio_q: "queue.Queue[np.ndarray]" = queue.Queue()


def on_audio(indata, frames, time_info, status):
    """Called by sounddevice for every block of captured audio."""
    if status:
        print(status, file=sys.stderr)
    # Keep mono float32 samples in [-1, 1]
    audio_q.put(indata[:, 0].copy())


def list_devices_and_exit():
    print(sd.query_devices())
    sys.exit(0)


def main():
    if "--list-devices" in sys.argv:
        list_devices_and_exit()

    print(f"Loading Whisper model '{MODEL_SIZE}' (first run downloads it, then it's offline)...")
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
                    segments, _ = model.transcribe(buffer, language="en")
                    text = " ".join(s.text.strip() for s in segments).strip()
                    if text:
                        print(text)
                    buffer = np.empty(0, dtype=np.float32)
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
