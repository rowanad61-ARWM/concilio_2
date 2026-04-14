export type RiskAllocation = "30/70" | "40/60" | "50/50" | "60/40" | "70/30" | "80/20" | "100"

export function scoreToAllocation(score: number): RiskAllocation {
  if (score <= 29) return "30/70"
  if (score <= 44) return "40/60"
  if (score <= 54) return "50/50"
  if (score <= 64) return "60/40"
  if (score <= 74) return "70/30"
  if (score <= 89) return "80/20"
  return "100"
}

export function allocationToRiskResult(allocation: RiskAllocation): string {
  return allocation
}
