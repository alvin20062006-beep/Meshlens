interface LLMRequest {
  system: string
  user: string
  maxTokens?: number
  /** When true, request OpenAI-compatible JSON object output (provider-dependent). */
  jsonObject?: boolean
}

interface LLMResponse {
  content: string
  success: boolean
  error?: string
}

function isProbablyUrl(v: string): boolean {
  return /^https?:\/\//i.test(v)
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "")
  // Allow passing either "https://host" or "https://host/v1"
  if (trimmed.endsWith("/v1")) return trimmed
  return `${trimmed}/v1`
}

function resolveBaseUrl(providerRaw: string | undefined): string {
  const v = (providerRaw || "").trim()
  if (!v) return "https://api.openai.com/v1"

  // If user provides a URL, treat it as base URL (and normalize to include /v1)
  if (isProbablyUrl(v)) return normalizeBaseUrl(v)

  // Otherwise treat it as a provider identifier and map known OpenAI-compatible hosts
  switch (v.toLowerCase()) {
    case "openai":
      return "https://api.openai.com/v1"
    case "kimi":
    case "moonshot":
    case "moonshotai":
      // Moonshot (Kimi) OpenAI-compatible API base
      return "https://api.moonshot.ai/v1"
    case "deepseek":
      return "https://api.deepseek.com/v1"
    default:
      // Back-compat: some users may have put a host without protocol in LLM_PROVIDER
      if (/^[\w.-]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(v)) return normalizeBaseUrl(`https://${v}`)
      return "https://api.openai.com/v1"
  }
}

export async function callLLM(request: LLMRequest): Promise<LLMResponse> {
  const apiKey = process.env.LLM_API_KEY
  const provider = process.env.LLM_PROVIDER
  const model = process.env.LLM_MODEL

  if (!apiKey || !model) {
    return { content: "", success: false, error: "LLM not configured" }
  }

  const baseUrl = resolveBaseUrl(provider)

  // LLM_TEMPERATURE env var is optional. Some reasoning models (e.g. kimi-k2.6)
  // only accept temperature=1 and will error on any other value.
  // If not set, we omit temperature entirely and let the provider use its default.
  const tempEnv = process.env.LLM_TEMPERATURE
  const temperature = tempEnv !== undefined ? Number(tempEnv) : undefined

  // LLM_MAX_TOKENS env var is optional. Reasoning models (e.g. kimi-k2.6) consume
  // many tokens for internal thinking before outputting content. Set this high enough
  // (e.g. 8000) to ensure reasoning + JSON output both fit within the budget.
  const maxTokensEnv = process.env.LLM_MAX_TOKENS
  const maxTokens = maxTokensEnv ? Number(maxTokensEnv) : (request.maxTokens || 1000)

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(request.jsonObject ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return { content: "", success: false, error: err }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ""
    return { content, success: true }
  } catch (e: unknown) {
    const error =
      e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error"
    return { content: "", success: false, error }
  }
}

export function parseJSONResponse(raw: string): object | null {
  const tryParse = (s: string): object | null => {
    try {
      return JSON.parse(s) as object
    } catch {
      return null
    }
  }

  const stripFences = (s: string) =>
    s
      .replace(/^\uFEFF/, "")
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim()

  const cleaned = stripFences(raw)
  const direct = tryParse(cleaned)
  if (direct) return direct

  // Some models wrap JSON in prose or use single quotes; extract the first {...} block.
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start >= 0 && end > start) {
    const slice = cleaned.slice(start, end + 1)
    const sliced = tryParse(slice)
    if (sliced) return sliced
  }

  return null
}

