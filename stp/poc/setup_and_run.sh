#!/usr/bin/env bash
#
# STP live-captions POC — one-shot setup + run for macOS.
#
#   Run on YOUR MAC (not the cloud session):   bash setup_and_run.sh
#
# It creates an isolated Python environment, installs the dependencies (first
# time only), writes live_captions.py, and starts live transcription.
# Grant the microphone permission prompt, then talk. Ctrl+C to stop.

set -e

mkdir -p ~/stp-poc && cd ~/stp-poc

if [ ! -d venv ]; then
  echo "==> Creating Python environment..."
  python3 -m venv venv
fi
source venv/bin/activate

echo "==> Installing dependencies (first run only, needs internet)..."
pip install --quiet --upgrade pip
pip install --quiet faster-whisper sounddevice numpy

echo "==> Writing live_captions.py..."
cat > live_captions.py <<'PY'
import sys, queue
import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel

SAMPLE_RATE = 16000
WINDOW_SECONDS = 5
MODEL_SIZE = "base.en"     # tiny.en | base.en | small.en
INPUT_DEVICE = None        # None = default mic; a number = mixer/interface

audio_q = queue.Queue()

def on_audio(indata, frames, time_info, status):
    if status: print(status, file=sys.stderr)
    audio_q.put(indata[:, 0].copy())

if "--list-devices" in sys.argv:
    print(sd.query_devices()); sys.exit(0)

print(f"Loading Whisper '{MODEL_SIZE}' (first run downloads it, then offline)...")
model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
print("Ready. Start talking. Ctrl+C to stop.\n")

buffer = np.empty(0, dtype=np.float32)
window = WINDOW_SECONDS * SAMPLE_RATE
with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32",
                    device=INPUT_DEVICE, callback=on_audio):
    try:
        while True:
            buffer = np.concatenate([buffer, audio_q.get()])
            if len(buffer) >= window:
                segments, _ = model.transcribe(buffer, language="en")
                text = " ".join(s.text.strip() for s in segments).strip()
                if text: print(text)
                buffer = np.empty(0, dtype=np.float32)
    except KeyboardInterrupt:
        print("\nStopped.")
PY

echo ""
echo "==> Starting. Allow the microphone prompt if it appears, then talk."
echo ""
python live_captions.py
