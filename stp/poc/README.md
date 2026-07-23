# POC #1 — Live captions on your Mac

**Goal:** prove the core pipeline — *you talk → plain text appears* — running
100% locally on your MacBook Air (M4, 24 GB). No cloud, no accounts.

> ⚠️ This runs on **your Mac**, not in the Claude cloud session. The cloud
> session has no microphone and is deleted when it ends. Everything below is
> meant to be pasted into your Mac's **Terminal** app.

## What it does

`live_captions.py` listens to your microphone, runs OpenAI's **Whisper** model
locally (via `faster-whisper`), and prints the transcribed text to the terminal.
It transcribes in ~5-second windows for now — talk, pause, watch the text. (True
low-latency streaming is a later iteration; right now we only prove the pipe.)

## Setup (one time)

Open **Terminal** on your Mac and run these, one block at a time:

```bash
# 1. Make a folder for the experiment and go into it
mkdir -p ~/stp-poc && cd ~/stp-poc

# 2. Create an isolated Python environment (keeps your Mac clean)
python3 -m venv venv
source venv/bin/activate

# 3. Install the three dependencies
pip install faster-whisper sounddevice numpy
```

Then copy `live_captions.py` from this repo into `~/stp-poc/` (or clone the repo
and copy it over).

## Run it

```bash
cd ~/stp-poc
source venv/bin/activate     # if not already active
python live_captions.py
```

- The **first run downloads the Whisper model once** (needs internet, ~150 MB
  for `base.en`). After that it runs **fully offline**.
- macOS will pop up a **microphone permission** prompt — click **Allow**. If you
  miss it: System Settings → Privacy & Security → Microphone → enable **Terminal**.
- Start talking. Text prints every ~5 seconds. Press **Ctrl+C** to stop.

## Feeding audio from the mixer (instead of the built-in mic)

Once talking-into-the-laptop works, point it at your audio interface / mixer:

```bash
# List all audio input devices and their numbers
python live_captions.py --list-devices
```

Find your interface in the list, note its **index number**, then open
`live_captions.py` and set `INPUT_DEVICE = <that number>`. Re-run. Now it
transcribes whatever the mixer sends — exactly the church setup.

## Knobs to experiment with (top of `live_captions.py`)

| Setting | Try this | Effect |
|---------|----------|--------|
| `MODEL_SIZE` | `"tiny.en"` | Fastest, least accurate — good for a first smoke test |
| `MODEL_SIZE` | `"base.en"` | **Default** — balanced |
| `MODEL_SIZE` | `"small.en"` | Most accurate, slower (your M4 can handle it) |
| `WINDOW_SECONDS` | `3` | Text appears sooner, but sees less context |
| `INPUT_DEVICE` | a device index | Use the mixer/interface instead of the built-in mic |

## What to report back

After you run it, tell me:
1. Did text appear when you talked? (yes/no)
2. Roughly how **accurate** was it?
3. How much **delay** did it feel like?
4. Any **errors** in the terminal (paste them)?

That tells us whether to (a) tune the model, (b) improve latency toward true
streaming, or (c) move on to the next module.

## Notes

- Verified on the build side: `faster-whisper` installs and imports cleanly and
  the script uses the standard Whisper API. The model download + microphone can
  only be exercised on your Mac (this cloud sandbox blocks both), so your run is
  the real first test.
- Apple Silicon (M4) runs Whisper well on CPU via `faster-whisper`. If we later
  want to use the M4 **GPU** for more speed, we can switch to `mlx-whisper`
  (Apple's MLX) — noted for a future iteration, not needed now.
