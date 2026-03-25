# KB Webhook → Kafka Event Bridge

## What
Register KB push notifications per tenant. Build listener that receives KB events and publishes to Kafka topics.

## Topics
- kb.invoice.created, kb.payment.success
- kb.subscription.created, kb.subscription.cancelled, kb.subscription.changed
- kb.overdue.state

## Approach
- Register KB push notification plugin per tenant (callback URL)
- Spring Boot listener receives POST from KB
- Publishes to appropriate Kafka topic

## Status
- Kafka topics exist and verified
- KB subscription lifecycle tested (create/pause/resume/cancel)
- KB recurring invoices confirmed working
- NO producer or consumer wired yet — this is the critical missing piece
