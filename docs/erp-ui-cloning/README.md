# ERP UI Cloning

Replacing iDempiere's ZK web UI with React, screen by screen. iDempiere stays
the engine (catalog, callouts, validation, processes, workflow). React +
Spring Boot + a small in-iDempiere BFF is the new face.

## Read these in order

1. [`method.md`](./method.md) — the architecture, BFF endpoint contract,
   modern admin GUI pattern (search → list → edit), constraints. Self-contained;
   read once.
2. The **per-screen shared instruction** for the screen you're working on
   (under `/tmp/shared-instruction/clone-idempiere-*.md`). Explains which
   iDempiere window to clone, what "done" looks like, and what the next step
   is.
3. The **iDempiere customization handoff**
   (`/tmp/shared-instruction/idempiere-customization-handoff.md`) only if you
   need to touch the BFF bundle or anything inside the iDempiere repo.

## Status

- `method.md` — done.
- `org.tb.bff` OSGi bundle — scaffold queued. Until it lands, list/read can
  use the existing direct-JDBC `IdempiereProductService`; writes need the BFF.
- First per-screen clone — Product (M_Product); see
  `/tmp/shared-instruction/clone-idempiere-product-screen.md`.
