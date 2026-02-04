# Copilot / AI Agent Instructions — RatioGlide

Short, actionable guidance for code edits and feature work in this repo.

1) Big picture
- Single-page static web app (frontend-only): UI in `index.html`, behavior in `script.js`, styles in `style.css`.
- Primary flow: config panel -> reader view (word pacer) -> quiz view -> results. The reader engine renders words as `span#word-{i}` and advances by interval (see `startPacer()` in `script.js`).

2) Key components & why
- `script.js`: central state object `state` holds words, WPM, api keys and quiz data. Mutations update DOM directly (no framework). Modify cautiously to avoid breaking synchronous UI updates.
- AI integration: `generateAIQuizWithRotation()` rotates API keys saved in localStorage under `ratioGlide_keys` and calls `fetchFromGemini(apiKey)` which expects a Gemini-like JSON response. The code strips markdown fences before JSON.parse — preserve that behavior when changing prompt/output parsing.
- Fallback path: `generateClozeQuiz()` creates cloze-style questions when AI fails or no keys provided. Keep both paths consistent in the `quizData` shape (id, questionText, options, correctAnswer).

3) Developer workflows
- No build step — run locally by opening `index.html` in a browser or serving the directory. Quick dev servers:
  - Python: `python -m http.server 8000` (from project root)
  - VS Code Live Server extension
- Debugging: use browser devtools. Useful breakpoints: `startPacer()`, `finishReading()`, `generateAIQuizWithRotation()` and `fetchFromGemini()`.

4) Project-specific conventions & patterns
- UI views are switched via `switchView(viewId)` which toggles four main panels: `config-panel`, `reader-view`, `quiz-view`, `results-view`.
- DOM IDs are relied on heavily; functions reference `getEl('word-#')`. When renaming IDs, update all selectors.
- Global functions exposed on `window`: `selectAnswer` and `calculateResults` (used inline in generated HTML). Keep them globally reachable if you change rendering strategy.
- Theme toggling uses `data-theme` on the `<html>` element. CSS variables control colors in `style.css`.

5) Integration & security notes
- External dependency: Gemini endpoint in `fetchFromGemini()` — requests are made client-side with API key in URL query (current implementation). Avoid committing actual keys. Keys are stored locally in browser `localStorage` only.
- When adding server-side proxy for API keys, remove client-side key usage and update `generateAIQuizWithRotation()` to call the proxy.

6) Examples to reuse
- Auto-load sample topics: `TOPIC_LIBRARY` (in `script.js`) — good for tests or fixtures.
- WPM calc: `const msPerWord = 60000 / state.targetWPM` (used by pacer).
- Quiz object shape example: `{ id: 1, questionText: "...", options: [...], correctAnswer: "..." }` — preserve when producing AI output.

7) Tests & CI
- No automated tests or CI configured. Small changes should be smoke-tested in the browser across light/dark themes and with/without API keys.

8) Editing and PR tips
- Keep changes minimal and preserve public DOM IDs and `state` shape.
- If altering AI prompts or response parsing, include sample responses in PR description and explain parsing logic changes.

If any section is unclear or you want more examples (specific lines to link to), tell me which area to expand.
