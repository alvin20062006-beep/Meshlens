type Props = {
  slug?: string
  mint?: string
  job_id?: string
  timestamp?: string
}

export function DataSources({ slug = "-", mint = "-", job_id = "-", timestamp = "-" }: Props) {
  const bagsUrl = slug && slug !== "-" ? `https://bags.fm/${slug}` : undefined
  return (
    <section className="ml-card">
      <h2 className="text-sm font-semibold">Data Sources</h2>

      <div className="mt-3 space-y-3 text-sm">
        <div>
          <div className="text-xs font-semibold text-[color:var(--text-primary)]">Project Context</div>
          <div className="mt-1 text-xs text-[color:var(--text-secondary)]">
            Bags →{" "}
            {bagsUrl ? (
              <a className="underline underline-offset-4 hover:opacity-80" href={bagsUrl} target="_blank" rel="noreferrer">
                {`bags.fm/${slug}`}
              </a>
            ) : (
              <span>-</span>
            )}{" "}
            → <span className="text-[color:var(--text-primary)]">{mint || "-"}</span>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-[color:var(--text-primary)]">Holder Data</div>
          <div className="mt-1 text-xs text-[color:var(--text-secondary)]">Helius DAS getTokenAccounts</div>
        </div>

        <div>
          <div className="text-xs font-semibold text-[color:var(--text-primary)]">Supply</div>
          <div className="mt-1 text-xs text-[color:var(--text-secondary)]">Solana RPC getTokenSupply</div>
        </div>

        <div>
          <div className="text-xs font-semibold text-[color:var(--text-primary)]">Snapshot</div>
          <div className="mt-1 text-xs text-[color:var(--text-secondary)]">
            {timestamp} | Job: {job_id}
          </div>
        </div>
      </div>
    </section>
  )
}

