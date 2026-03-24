# Overdue → Service Suspension Automation

## Lifecycle
- Day +7 unpaid: WARNING → notify customer (email/SMS)
- Day +14 unpaid: SUSPENDED → PUT /bundles/{id}/pause → PackageAccount deactivated
- Day +30 unpaid: CANCELLED → DELETE subscription → PackageAccount removed

## Exists
- KB overdue/dunning support
- Kafka topic kb.overdue.state
- Tenant config has overdue policy (warning:7d, suspend:14d, disconnect:30d)

## Missing
- KB overdue config set per tenant
- Kafka consumer for kb.overdue.state
- Consumer calls RTC-Manager to deactivate/remove PackageAccount
- Notification dispatch to platform.notifications topic

## Blocked by
- Event bridge and RTC provisioning
