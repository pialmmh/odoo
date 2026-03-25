# Deployment Scripts for Platform Services

## What
Create deployment tooling following routesphere/sigtran deploy patterns for LXC containers.

## Services to deploy
- Odoo, Kill Bill, Spring Boot API, APISIX, Kafka, React UI

## Follows
- routesphere deploy: /home/mustafa/telcobright-projects/routesphere/routesphere-core/tools/deploy
- sigtran deploy: /home/mustafa/telcobright-projects/sigtran/tools/deploy
- Networking: /home/mustafa/telcobright-projects/orchestrix/images/networking_guideline_claude.md
- Config from: config/tenants/{slug}/{profile}
- Debian 12, ports in 7000 range, per-host /24 subnets
