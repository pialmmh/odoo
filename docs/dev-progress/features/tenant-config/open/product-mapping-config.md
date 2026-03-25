# Add Product Mapping Config to Tenant YAML Profiles

**Task:** #7
**Priority:** High (blocks RTC provisioning #6)

## What
Map KB plan names → PackageItem[] templates so the Kafka consumer knows what PackageAccounts to create when a subscription is provisioned.

## Where
Add `platform.product-mapping` section to each tenant's profile YAML.

## Example for btcl dev (config/tenants/btcl/dev/profile-dev.yml)
```yaml
platform:
  product-mapping:
    # Internet plans
    internet-100mbps-monthly:
      - { name: "Bandwidth", quantity: 100, uom: "MBPS", category: 1 }
      - { name: "Data Transfer", quantity: 999999999, uom: "GB", category: 2 }
    internet-50mbps-monthly:
      - { name: "Bandwidth", quantity: 50, uom: "MBPS", category: 1 }
      - { name: "Data Transfer", quantity: 999999999, uom: "GB", category: 2 }
    internet-200mbps-monthly:
      - { name: "Bandwidth", quantity: 200, uom: "MBPS", category: 1 }
      - { name: "Data Transfer", quantity: 999999999, uom: "GB", category: 2 }

    # Hosted PBX plans
    hosted-pbx-bronze-monthly:
      - { name: "SIP Extensions", quantity: 10, uom: "EXT", category: 1 }
      - { name: "Call Channels", quantity: 5, uom: "CH", category: 2 }
      - { name: "IVR Configs", quantity: 2, uom: "IVR", category: 3 }
      - { name: "Free Talktime", quantity: 500, uom: "MIN", category: 4 }
    hosted-pbx-silver-monthly:
      - { name: "SIP Extensions", quantity: 30, uom: "EXT", category: 1 }
      - { name: "Call Channels", quantity: 7, uom: "CH", category: 2 }
      - { name: "IVR Configs", quantity: 5, uom: "IVR", category: 3 }
      - { name: "Free Talktime", quantity: 1000, uom: "MIN", category: 4 }
    hosted-pbx-gold-monthly:
      - { name: "SIP Extensions", quantity: 100, uom: "EXT", category: 1 }
      - { name: "Call Channels", quantity: 15, uom: "CH", category: 2 }
      - { name: "IVR Configs", quantity: 10, uom: "IVR", category: 3 }
      - { name: "Free Talktime", quantity: 3000, uom: "MIN", category: 4 }

    # Voice Broadcast plans
    vbs-basic-monthly:
      - { name: "VBS Messages", quantity: 20000, uom: "MSG", category: 1 }
    vbs-standard-monthly:
      - { name: "VBS Messages", quantity: 50000, uom: "MSG", category: 1 }
    vbs-enterprise-monthly:
      - { name: "VBS Messages", quantity: 999999999, uom: "MSG", category: 1 }

    # Contact Center (per-unit, multiplied by subscription quantity)
    contact-center-monthly:
      - { name: "Agent Seats", quantity: 1, uom: "AGENT", category: 1, per-unit: true }
      - { name: "Call Channels", quantity: 1, uom: "CH", category: 2, per-unit: true }
      - { name: "CRM Seats", quantity: 1, uom: "SEAT", category: 3, per-unit: true }
```

## Notes
- `per-unit: true` means quantity is multiplied by the subscription quantity (for contact center agents)
- Categories match RTC-Manager's EnumServiceCategory
- UOMs must match RTC-Manager's UOM table entries
- Same mapping needed for all tenants that use these products (can differ per tenant if they have different packages)
