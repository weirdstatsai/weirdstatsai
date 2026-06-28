# WeirdStats Backend

The API the Angular app talks to. Receives a question, forwards it to the
agent service (`../agent`), and returns chart data.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # adjust AGENT_URL if needed
uvicorn app.main:app --reload --port 8000
```

## Endpoints

- `GET /health` - health check
- `POST /api/generate` - body `{ "prompt": "...", "preferredType": "bar" }`,
  returns chart JSON (see `app/schemas.py`)

If the agent service at `AGENT_URL` is unreachable, this falls back to a
local mock generator (`app/mock_generator.py`) so the frontend keeps working.
