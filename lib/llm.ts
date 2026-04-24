interface LLMRequest {
  system: string
  user: string
  maxTokens?: number
}

interface LLMResponse {
  content: string
  success: boolean
  error?: string
}

export async function callLLM(request: LLMRequest): Promise<LLMResponse> {
  const apiKey = process.env.LLM_API_KEY
  const provider = process.env.LLM_PROVIDER
  const model = process.env.LLM_MODEL

  if (!apiKey || !model) {
    return { content: "", success: false, error: "LLM not configured" }
  }

  // Determine base URL from provider
  // If LLM_PROVIDER is set, use it as the base URL
  // Default to a chat/completions-compatible format
  const baseUrl = provider || "https://api.example.com/v1"

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens || 1000,
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
  try {
    // Strip markdown code blocks if present
    const cleaned = raw.replace(/```json\\s*/g, "").replace(/```\\s*/g, "").trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

