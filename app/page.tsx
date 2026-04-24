import { BadgeCheck, Layers, RefreshCcw } from "lucide-react";

export default function Home() {
  return (
    <main className="relative flex min-h-[calc(100vh-0px)] w-full items-center justify-center overflow-hidden p-6">
      {/* Geometric decorations (no glows, no shadows) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-8 top-14 size-20 border border-[#1e2d6b]" />
        <div
          className="absolute right-10 top-24 size-16 border border-[#1e2d6b]"
          style={{ transform: "rotate(45deg)" }}
        />
        <div
          className="absolute left-16 bottom-20 size-0 border-x-[28px] border-b-[48px] border-x-transparent border-b-[#1e2d6b]"
          style={{ opacity: 0.9 }}
        />
        <div
          className="absolute right-14 bottom-16 size-0 border-x-[22px] border-b-[38px] border-x-transparent border-b-[#1e2d6b]"
          style={{ transform: "rotate(180deg)", opacity: 0.8 }}
        />
      </div>

      <section className="relative mx-auto w-full max-w-6xl text-center">
        <div className="mx-auto max-w-3xl">
          <div className="text-5xl font-bold tracking-tight text-[color:var(--text-primary)] sm:text-6xl">
            MeshLens
          </div>
          <p className="mt-4 text-lg font-medium text-[color:var(--text-secondary)]">
            Verifiable Agent Marketplace for Token Projects
          </p>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)] sm:text-base">
            Every output is grounded in real on-chain data and can be replayed and audited.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="ml-card text-left">
            <div className="flex items-start gap-3">
              <span
                className="inline-flex size-10 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-[color:var(--text-primary)]"
                aria-hidden
              >
                <Layers className="size-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Project-Bound</div>
                <div className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">
                  Only verified Bags projects can access agents
                </div>
              </div>
            </div>
          </div>

          <div className="ml-card text-left">
            <div className="flex items-start gap-3">
              <span
                className="inline-flex size-10 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-[color:var(--text-primary)]"
                aria-hidden
              >
                <BadgeCheck className="size-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Data-Verified</div>
                <div className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">
                  Every output cites real on-chain sources
                </div>
              </div>
            </div>
          </div>

          <div className="ml-card text-left">
            <div className="flex items-start gap-3">
              <span
                className="inline-flex size-10 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] text-[color:var(--text-primary)]"
                aria-hidden
              >
                <RefreshCcw className="size-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Replayable</div>
                <div className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">
                  Every job stored as an auditable snapshot
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <a className="ml-btn-primary inline-flex h-12 items-center justify-center px-6 text-sm font-semibold" href="/connect">
            Launch App
          </a>
        </div>

        <footer className="mt-10 text-xs text-[color:var(--text-secondary)]">
          Not a launchpad. Not a terminal. An execution layer.
        </footer>
      </section>
    </main>
  );
}
