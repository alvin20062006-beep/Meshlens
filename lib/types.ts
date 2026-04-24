export interface Project {
  id?: string
  source_url: string
  resolved_slug: string
  resolved_mint: string
  verification: "Verified from Bags" | "Demo Project"
  name: string
}

export interface Agent {
  agent_id: string
  name: string
  provider: string
  version: string
  capabilities: string[]
  input_schema: object
  output_schema: object
  price: number
  status: "active" | "preview" | "coming_soon"
  description: string
}

export interface HolderAccount {
  address: string
  amount_ui: number
  percent_of_supply: number
}

export interface RiskFlag {
  key: string
  severity: "low" | "medium" | "high"
  evidence: string
}

export interface Action {
  title: string
  why: string
  priority: "P1" | "P2" | "P3"
}

export interface Citation {
  label: string
  source: string
  job_id: string
  timestamp: string
}

export interface JobOutput {
  distribution: {
    top5_percent: number
    top10_percent: number
    accounts: HolderAccount[]
  }
  risk_flags: RiskFlag[]
  actions: Action[]
  citations: Citation[]
  summary?: string
}

export interface Job {
  job_id: string
  agent_id: string
  project: Project
  input: object
  data_snapshot: object | null
  output: JobOutput | null
  status: "pending" | "running" | "completed" | "failed"
  timestamp: string
  error?: string
}

