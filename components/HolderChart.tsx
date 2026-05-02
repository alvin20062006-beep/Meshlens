"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  accounts: Array<{ address: string; percent_of_supply: number }>;
};

function truncAddr(a: string) {
  const s = String(a || "")
  if (s.length <= 6) return s
  return s.slice(0, 6)
}

export function HolderChart({ accounts }: Props) {
  const data = accounts.map((a, idx) => ({
    address: a.address,
    label: truncAddr(a.address),
    percent: a.percent_of_supply,
    isTop1: idx === 0,
  }))

  return (
    <div className="h-64 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="var(--text-secondary)" />
          <YAxis tickFormatter={(v) => `${v}%`} stroke="var(--text-secondary)" />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              color: "#ffffff",
            }}
            itemStyle={{ color: "#ffffff" }}
            labelStyle={{ color: "#ffffff" }}
            formatter={(v: unknown, _name: unknown, item: unknown) => {
              const pct = typeof v === "number" ? v : Number(v)
              const rec = item && typeof item === "object" ? (item as Record<string, unknown>) : null
              const payload = rec && typeof rec.payload === "object" ? (rec.payload as Record<string, unknown>) : null
              const addr = payload?.address ? String(payload.address) : "-"
              return [`${pct.toFixed(4)}%`, addr]
            }}
            labelFormatter={() => ""}
          />
          <Bar dataKey="percent" radius={[6, 6, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell
                key={`c-${idx}`}
                fill={entry.isTop1 ? "var(--accent-hover)" : "var(--accent)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

