# Pluggable LLM Provider

Meshlens uses a pluggable LLM API. Users can choose their preferred provider/model (Claude, Gemini, DeepSeek, OpenAI, etc.) by swapping configuration.

## Environment variables

- `LLM_API_KEY=`: your provider API key
- `LLM_PROVIDER=` (optional): provider identifier (e.g. `custom`, `self_hosted`, etc.)
- `LLM_MODEL=` (optional): model identifier string for the chosen provider
- `HELIUS_API_KEY=`: required for on-chain holder data

Do **not** commit real secrets.

