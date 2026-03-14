# Catalog Sync — Odoo Products → Kill Bill Catalog XML

## Overview

Odoo is the master for product catalog. When products/plans change in Odoo, the sync service generates catalog XML and uploads it to Kill Bill.

## Odoo Product → KB Catalog Mapping

| Odoo Field | KB Catalog Element | Example |
|---|---|---|
| `product.template.name` | Display name (UI only) | "Internet 100Mbps" |
| `product.template.x_kb_product_name` | `<product name="...">` | `Internet-100Mbps` |
| `product.template.x_kb_category` | `<category>` | `BASE` or `ADD_ON` |
| `product.product.x_kb_plan_name` | `<plan name="...">` | `internet-100mbps-monthly` |
| `product.product.list_price` | `<value>` in `<recurringPrice>` | `1200.00` |
| `product.product.x_kb_billing_period` | `<billingPeriod>` | `MONTHLY` |
| `product.product.x_kb_has_trial` | Whether `<initialPhase>` exists | `false` |
| `product.product.x_kb_trial_days` | `<duration><number>` in trial | `14` |

## Catalog XML Structure

Must match this exact format (from the real catalog at `odoo/killbill-billing/catalogs/isp-catalog.xml`):

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<catalog xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="CatalogSchema.xsd ">

    <effectiveDate>2026-03-15T00:00:00+00:00</effectiveDate>
    <catalogName>TelcobrightISP</catalogName>

    <recurringBillingMode>IN_ADVANCE</recurringBillingMode>

    <currencies>
        <currency>BDT</currency>
    </currencies>

    <products>
        <!-- One per product.template where x_kb_product_name is set -->
        <product name="Internet-100Mbps">
            <category>BASE</category>
        </product>
        <product name="StaticIP">
            <category>ADD_ON</category>
        </product>
    </products>

    <!-- Hardcoded defaults — do not change -->
    <rules>
        <changePolicy>
            <changePolicyCase>
                <policy>IMMEDIATE</policy>
            </changePolicyCase>
        </changePolicy>
        <changeAlignment>
            <changeAlignmentCase>
                <alignment>START_OF_SUBSCRIPTION</alignment>
            </changeAlignmentCase>
        </changeAlignment>
        <cancelPolicy>
            <cancelPolicyCase>
                <policy>END_OF_TERM</policy>
            </cancelPolicyCase>
        </cancelPolicy>
        <createAlignment>
            <createAlignmentCase>
                <alignment>START_OF_BUNDLE</alignment>
            </createAlignmentCase>
        </createAlignment>
    </rules>

    <plans>
        <!-- One per product.product where x_kb_plan_name is set -->

        <!-- Plan WITHOUT trial (x_kb_has_trial=false) -->
        <plan name="internet-100mbps-monthly">
            <product>Internet-100Mbps</product>
            <finalPhase type="EVERGREEN">
                <duration>
                    <unit>UNLIMITED</unit>
                </duration>
                <recurring>
                    <billingPeriod>MONTHLY</billingPeriod>
                    <recurringPrice>
                        <price>
                            <currency>BDT</currency>
                            <value>1200.00</value>
                        </price>
                    </recurringPrice>
                </recurring>
            </finalPhase>
        </plan>

        <!-- Plan WITH trial (x_kb_has_trial=true, x_kb_trial_days=14) -->
        <plan name="internet-100mbps-trial-monthly">
            <product>Internet-100Mbps</product>
            <initialPhases>
                <phase type="TRIAL">
                    <duration>
                        <unit>DAYS</unit>
                        <number>14</number>
                    </duration>
                    <fixed>
                        <fixedPrice>
                            <price>
                                <currency>BDT</currency>
                                <value>0</value>
                            </price>
                        </fixedPrice>
                    </fixed>
                </phase>
            </initialPhases>
            <finalPhase type="EVERGREEN">
                <duration>
                    <unit>UNLIMITED</unit>
                </duration>
                <recurring>
                    <billingPeriod>MONTHLY</billingPeriod>
                    <recurringPrice>
                        <price>
                            <currency>BDT</currency>
                            <value>1200.00</value>
                        </price>
                    </recurringPrice>
                </recurring>
            </finalPhase>
        </plan>
    </plans>

    <priceLists>
        <defaultPriceList name="DEFAULT">
            <plans>
                <plan>internet-100mbps-monthly</plan>
                <plan>internet-100mbps-trial-monthly</plan>
            </plans>
        </defaultPriceList>
    </priceLists>

</catalog>
```

## Generation Rules

1. `<effectiveDate>` = current UTC timestamp (ISO 8601)
2. `<catalogName>` = `TelcobrightISP` (hardcoded)
3. `<currencies>` = `BDT` only
4. `<products>` = one entry per `product.template` where `x_kb_product_name` is set and product is active
5. `<rules>` = hardcoded defaults (never change)
6. `<plans>` = one entry per `product.product` where `x_kb_plan_name` is set and variant is active
   - `x_kb_has_trial` is false → only `<finalPhase>` (EVERGREEN)
   - `x_kb_has_trial` is true → `<initialPhases>` with TRIAL (0 cost, DAYS, `x_kb_trial_days`) + `<finalPhase>` EVERGREEN
7. `<priceLists>` = single DEFAULT price list listing all plan names

## Change Detection

Before uploading:
1. Generate XML from current Odoo products
2. Strip `<effectiveDate>` line from XML
3. Compute SHA256 of remaining XML
4. Query last `kb.sync.log` with `operation=catalog_upload`, `status=success`
5. If `catalog_hash` matches → skip upload
6. If different → upload, log new hash

## Upload API Call

```
POST http://localhost:18080/1.0/kb/catalog/xml
Headers:
  Content-Type: text/xml
  X-Killbill-ApiKey: {from res.company.x_kb_api_key}
  X-Killbill-ApiSecret: {from res.company.x_kb_api_secret}
  X-Killbill-CreatedBy: odoo-sync
  Authorization: Basic admin:password
Body: {generated catalog XML}
```

Note: Catalog upload is per-tenant. If products are shared across tenants, the same catalog XML gets uploaded to each tenant using their respective API key/secret.
