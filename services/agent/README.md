# WeirdStats Agent

The OpenAI-powered agent. Receives `{ "prompt": "...", "preferredType": "bar" }`
from the backend (`../backend`) and returns chart-ready JSON.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add your OPENAI_API_KEY
uvicorn app.main:app --reload --port 8100
```

## Endpoints

- `GET /health` - health check
- `POST /agent/generate` - see `app/schemas.py` for the request/response shape

`app/main.py` currently returns a placeholder response. Replace the body of
`generate()` with a real OpenAI call - see the docstring in that file for a
suggested prompt/response-format setup using structured JSON output.
