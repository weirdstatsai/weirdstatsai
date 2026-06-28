# Weird Stats — Mobile App

An AI-powered graph generator built with Ionic Angular.

## Run in browser (2 commands)

```bash
cd "weird-stats-app"
npm install
npx ng serve --open
```

The app opens at **http://localhost:4200** in mobile view.

## Screens

| Screen | Description |
|--------|-------------|
| Home | Recent graphs feed + AI prompt shortcut |
| Generate | Describe a graph → AI generates it with Chart.js |
| My Graphs | All/saved graphs with search + delete |
| Graph Detail | Full chart view, AI insight, save/share/download |

## How the AI works

The AI service (`src/app/services/ai.service.ts`) analyses your prompt for:
- **Keywords** → picks a chart type (bar, line, scatter, donut, radar, bubble…)
- **Theme** → generates contextually appropriate data (coffee, sleep, countries, tech…)
- **Weirdness score** → 1–10 based on how bizarre the correlation is

To connect a real AI (e.g. Claude API), replace `AiService.generateGraph()` with an HTTP call and parse the response into a `GraphConfig`.

## Tech stack

- **Ionic 7** — mobile UI components
- **Angular 16** — framework
- **Chart.js 4** — charts
- **LocalStorage** — persists saved graphs between sessions
