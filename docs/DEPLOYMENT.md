# Production deployment plan

## Recommended cloud shape

### Frontend
Option A: Vercel
- Next.js deployment
- edge/CDN
- preview environments
- automatic rollbacks

Option B: Azure Front Door + Container Apps
- useful if the business wants one Azure estate

### API
- Docker image
- Azure Container Apps or AKS
- minimum 2 instances
- horizontal autoscaling
- stateless processes

### Database
- Azure SQL Database / Managed Instance
- private networking
- encrypted backups
- monitoring
- separate app and migration identities

### Media
- Azure Blob Storage
- CDN/Front Door
- responsive image variants

### Async
- Azure Service Bus for order/email/media events
- worker containers

### Cache
- Azure Cache for Redis

## Environment separation

- local
- development
- staging
- production

Never point local Docker SQL Server at production credentials.

## Deployment gates

1. typecheck
2. unit tests
3. build
4. migration validation
5. E2E smoke test
6. security/dependency scan
7. deploy to staging
8. smoke test staging
9. production deployment
10. post-deploy health check

## Load testing

Before a 1M-user launch:
- define expected concurrent sessions
- define checkout peak
- define catalog QPS
- test cache-hit and cache-miss paths
- test database connection exhaustion
- test payment webhook retries
- test inventory contention

A "1 million users" requirement is not enough to size infrastructure. Peak concurrent users and peak requests/second determine capacity.

## Production commerce configuration

Run the latest database migration before starting the API:

```bash
npm run db:migrate
```

The production commerce layer supports:

- Razorpay Orders API + server-side signature verification
- Razorpay payment webhooks (`POST /webhooks/razorpay`) with HMAC validation and idempotency
- Inventory reservations with automatic expiry/release
- Coupons and one-use-per-customer redemption
- Configurable GST/tax and shipping/free-shipping rules
- Customer saved addresses
- Order cancellation and return requests
- Full/partial Razorpay refunds
- Order status history and audit-style operational records
- Optional transactional order emails through Resend
- Manual carrier tracking URLs and Google Maps delivery links

Required environment variables for live payments:

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Optional commerce configuration:

```env
GST_RATE_PERCENT=0
SHIPPING_FLAT_INR=0
FREE_SHIPPING_THRESHOLD_INR=0
PAYMENT_RESERVATION_MINUTES=15
RESEND_API_KEY=
EMAIL_FROM=SmolStudio <orders@example.com>
```

Configure the Razorpay webhook URL as:

```text
https://<your-api-domain>/webhooks/razorpay
```

Recommended Razorpay webhook events include `payment.captured`, `payment.failed`, and `order.paid`. Razorpay recommends webhooks for asynchronous server-side confirmation while retaining immediate signature/API verification for customer-facing payment completion.
