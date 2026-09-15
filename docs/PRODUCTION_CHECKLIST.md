# SmolStudio production checklist

## Before deployment

1. Copy `.env.example` to your deployment secret store and set real values.
2. Use a strong SQL Server password and a managed/private SQL Server in production.
3. Run `npm ci` and `npm run build` on the deployment machine (Node 24).
4. Run `npm run db:migrate` once against the production database.
5. Configure `PUBLIC_API_URL` to the public HTTPS API URL.
6. Configure `CORS_ORIGIN` to the exact storefront origin(s).
7. Configure Razorpay test keys first, then live keys after end-to-end testing.
8. Configure Razorpay webhook secret and public endpoint `/webhooks/razorpay`.
9. Enable Razorpay automatic payment capture.
10. Configure `GST_RATE_PERCENT`, `SHIPPING_FLAT_INR`, and `FREE_SHIPPING_THRESHOLD_INR` for the store's tax/shipping policy.
11. Configure an email provider (`RESEND_API_KEY`, `EMAIL_FROM`) if order emails are desired.
12. Back up SQL Server and persist the `apps/api/uploads` volume.

## Razorpay webhook events

Subscribe to:

- `payment.captured`
- `payment.failed`
- `order.paid`

The application validates `X-Razorpay-Signature`, records webhook event IDs for idempotency, and uses the Checkout signature/API verification path for immediate customer-facing confirmation.

## Operations covered by the application

- Product/catalog administration
- Product images and variants
- Inventory reservations and expiry
- Cart and checkout
- Coupons
- Tax and shipping calculation
- Razorpay payments
- Payment webhook reconciliation
- Full and partial refunds
- Order cancellation
- Returns
- Order status history
- Shipment tracking URL/carrier/AWB
- Google Maps delivery links
- Saved customer addresses
- Customer/order administration
- Category administration
- Optional order email notifications
