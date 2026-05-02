# Pluggable LLM Provider

Meshlens uses a pluggable LLM API. Users can choose their preferred provider/model (Claude, Gemini, DeepSeek, OpenAI, etc.) by swapping configuration.

## Environment variables

- `LLM_API_KEY=`: your provider API key
- `LLM_PROVIDER=` (optional): either a **provider id** (`openai` / `moonshot` / `kimi` / `deepseek`) or a **base URL**
  - Moonshot provider id: `moonshot` (resolves to `https://api.moonshot.ai/v1`)
  - Example base URL: `https://api.moonshot.ai/v1` (or `https://api.moonshot.ai`, will be normalized to `.../v1`)
- `LLM_MODEL=`: model identifier string for the chosen provider (**required** for agents that perform LLM analysis)
- `HELIUS_API_KEY=`: required for on-chain holder data

Do **not** commit real secrets.

