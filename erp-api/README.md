# erp-api — iDempiere OSGi bundle (trial)

A Telcobright OSGi bundle that runs **inside iDempiere's existing JVM** and
serves REST endpoints on iDempiere's existing Jetty (port 7079).

This is the trial: a single `/erp-api/health` endpoint that returns JSON
proving the bundle is loaded and the request path works end-to-end. Once
that's green, the same bundle grows the real GridTab-backed window
endpoints (`/erp-api/window/{id}/...`).

**Why this approach** (vs a peer Spring Boot JVM that embeds iDempiere
jars): one JVM, one classloader, native access to `GridTab` / `MProduct` /
`Adempiere` without a second startup, no Java-17/Java-21 split. See
`/tmp/shared-instruction/idempiere-rest-plugin-blocker.md` (the post-update
sections) for the architecture decision.

## Build

Java 17 required — iDempiere 12 BREE is JavaSE-17.

```
export JAVA_HOME=/home/mustafa/.sdkman/candidates/java/17.0.16-librca
export PATH=$JAVA_HOME/bin:$PATH
cd erp-api
mvn -DskipTests package
# → target/erp-api-1.0.0.jar
```

## Install (two ways)

iDempiere plugins folder:

```
/home/mustafa/telcobright-projects/idempiere/idempiere-server/\
  org.idempiere.p2/target/products/org.adempiere.server.product/linux/gtk/x86_64/plugins/
```

### Option 1 — drop and restart (clean)

```
cp target/erp-api-1.0.0.jar /path/to/idempiere/.../plugins/
# stop iDempiere, then start it again
```

### Option 2 — hot-install via Felix console (no restart)

1. Browse to <http://localhost:7079/osgi/system/console/bundles>
   (login: `SuperUser` / `System`)
2. Click **Install/Update**, upload `target/erp-api-1.0.0.jar`, click
   **Start Bundle**, then **Install or Update**.
3. Verify the bundle is in the **Active** state.

## Validate

```
curl -s http://localhost:7079/erp-api/health
# {"ok":true,"bundle":"com.telcobright.erp.api","version":"1.0.0","timestamp":"…"}
```

If it 404s after install, check `idempiere.log` for
`[erp-api] registered /erp-api/health` (printed by the Activator).

## What's next once health is green

In this same bundle (or a sibling):

- `GET  /erp-api/window/{adWindowId}/spec`
- `GET  /erp-api/window/{adWindowId}/tab/{tabIdx}/rows?parentId=…&search=…&page=…&size=…`
- `GET  /erp-api/window/{adWindowId}/tab/{tabIdx}/row/{id}`
- `GET  /erp-api/window/{adWindowId}/tab/{tabIdx}/defaults`
- `PATCH /erp-api/window/{adWindowId}/tab/{tabIdx}/row/{id}`   (fires callouts)
- `POST /erp-api/window/{adWindowId}/tab/{tabIdx}/row/{id}/save`
- `POST /erp-api/window/{adWindowId}/tab/{tabIdx}/row/{id}/action`  (DocActions)
- `DELETE /erp-api/window/{adWindowId}/tab/{tabIdx}/row/{id}`
- `GET  /erp-api/lookup/{ad_reference_id}?search=…`

The Spring Boot api at `:8180` then proxies `/api/erp/*` →
`http://localhost:7079/erp-api/*` and adds Keycloak JWT validation.
