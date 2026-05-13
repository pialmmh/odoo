export default function OrchestrixPage() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <h1 className="text-2xl font-semibold text-primary">Orchestrix</h1>
      <p className="text-sm text-secondary max-w-prose">
        Infrastructure management surface. Containers, networking, deployments, and tenants will be
        ported here from the legacy orchestrix-ui as Plane-native pages.
      </p>
      <div className="mt-6 rounded-md border border-subtle bg-surface-1 p-6 text-sm text-tertiary italic">
        Nothing wired yet — this is the doorway. Add subsections under
        <code className="mx-1 rounded bg-layer-2 px-1.5 py-0.5 not-italic text-secondary">
          apps/web/app/(all)/[workspaceSlug]/(projects)/orchestrix/
        </code>
        and a matching entry in
        <code className="mx-1 rounded bg-layer-2 px-1.5 py-0.5 not-italic text-secondary">
          packages/constants/src/workspace.ts
        </code>
        .
      </div>
    </div>
  );
}
