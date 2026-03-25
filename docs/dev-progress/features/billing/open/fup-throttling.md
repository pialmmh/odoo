# Fair Usage Policy (FUP) & Throttling

## What
When a PackageAccount quota is exhausted, automatically throttle or restrict the service instead of cutting off completely.

## How it works
1. PackageAccount balance reaches threshold (e.g., 90% used → warning)
2. PackageAccount balance reaches 0 → FUP triggered
3. RTC-Manager publishes event to `platform.notifications` (customer alert)
4. RTC-Manager applies throttle rule:
   - Internet: reduce speed from 100Mbps → 2Mbps
   - Voice: block outgoing, allow incoming
   - SMS: block sending

## FUP rules (per PackageItem category)
| Category | Throttle action | Restore on |
|----------|----------------|------------|
| Bandwidth | Reduce to FUP speed (e.g., 2Mbps) | Next billing cycle or top-up |
| Data Transfer | Reduce speed | Next cycle or top-up |
| Talktime | Block outgoing calls | Top-up |
| SMS | Block sending | Top-up |

## Configuration
Add to tenant YAML under `platform.fup`:
```yaml
platform:
  fup:
    warning-threshold-percent: 90
    rules:
      - category: 1  # Bandwidth
        action: THROTTLE
        throttle-to: 2  # Mbps
      - category: 4  # Talktime
        action: BLOCK_OUTGOING
```

## Blocked by
- PackageAccount balance tracking (exists), event bridge, notification service
