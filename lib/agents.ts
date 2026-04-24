import { Agent } from "./types"

export const agentRegistry: Agent[] = [
  {
    agent_id: "holder_insight_v1",
    name: "Holder Insight Agent",
    provider: "MeshLens Labs",
    version: "1.0",
    capabilities: ["holder_analysis", "risk_detection", "concentration_scoring"],
    input_schema: { project_id: "string" },
    output_schema: { distribution: "object", risk_flags: "array", actions: "array" },
    price: 10,
    status: "active",
    description:
      "Analyze token holder distribution with real on-chain data. Detects concentration risk and generates data-backed recommendations.",
  },
  {
    agent_id: "growth_strategist_v1",
    name: "Growth Strategist Agent",
    provider: "MeshLens Labs",
    version: "1.0",
    capabilities: ["content_planning", "growth_strategy"],
    input_schema: { project_id: "string" },
    output_schema: { days: "array", themes: "array" },
    price: 8,
    status: "active",
    description: "Generate a 7-day growth plan based on your holder distribution and project context.",
  },
  {
    agent_id: "community_copilot_v1",
    name: "Community Copilot",
    provider: "MeshLens Labs",
    version: "0.9",
    capabilities: ["faq_generation", "community_scripts"],
    input_schema: { project_id: "string" },
    output_schema: { faqs: "array", scripts: "array" },
    price: 5,
    status: "preview",
    description: "Auto-generate FAQ templates and community reply scripts for your project.",
  },
]

export function importAgent(manifest: Partial<Agent>): Agent {
  const newAgent: Agent = {
    agent_id: manifest.agent_id || "custom_" + Date.now(),
    name: manifest.name || "Custom Agent",
    provider: manifest.provider || "External",
    version: manifest.version || "0.1",
    capabilities: manifest.capabilities || [],
    input_schema: manifest.input_schema || {},
    output_schema: manifest.output_schema || {},
    price: manifest.price || 0,
    status: "coming_soon",
    description: manifest.description || "Imported agent",
  }
  agentRegistry.push(newAgent)
  return newAgent
}

