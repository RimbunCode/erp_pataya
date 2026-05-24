import Icon from "@/Components/ui/Icon";

export default function TabOrganizations({ orgs = [], orgsMeta = null }) {
  const isReady = Boolean(orgsMeta?.ready);

  return (
    <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 overflow-auto">
      <div className="max-w-3xl">
        <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
          Organizations
        </p>
        <h2 className="mt-2 text-xl font-black text-[var(--foreground)] tracking-tight uppercase">
          Backend Integration {isReady ? "Ready" : "Pending"}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
          {orgsMeta?.message ??
            "Organizations tab is currently a placeholder and will be connected to backend data in the next implementation phase."}
        </p>

        <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--background-accent)] p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--secondary)] flex items-center justify-center">
              <Icon
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                cls="w-5 h-5 text-[var(--muted-foreground)]"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Placeholder Mode
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)] leading-relaxed">
                Existing data count:{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {orgs.length}
                </span>
                . CRUD actions are intentionally disabled until organization
                endpoints are implemented.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
