# SmolStudio requirements - v0.1

## Business goal

Create a premium, warm and trustworthy online storefront for babywear and children's clothing, while keeping the technology simple enough for a small business to operate and scalable enough to support a future 1M-user audience.

## Personas

### Shopper
Needs:
- fast mobile browsing
- clear sizes/prices
- trustworthy product photos
- simple cart
- frictionless checkout
- order status

### Store owner
Needs:
- manage products
- manage inventory
- see orders
- update order status
- manage promotional codes
- upload product media

### Operations
Needs:
- auditable stock changes
- payment reconciliation
- shipment tracking
- customer support history

## Non-functional requirements

- p95 API read latency target: <300 ms for cache-warm catalog reads
- p95 page response target: <1.5 s on a good mobile connection for cached pages
- stateless API nodes
- idempotent checkout/payment operations
- structured logs
- health/readiness endpoints
- rate limiting
- input validation
- automated tests
- migrations
- backups and restore drills
- no card data stored in SmolStudio DB
- all secrets injected at runtime

## 1M-user scaling principles

1. CDN all public media.
2. Cache category/product reads.
3. Keep API instances stateless.
4. Use SQL indexes for catalog and order access.
5. Use cursor pagination instead of large OFFSET pages.
6. Move email, media processing and analytics to queues.
7. Use managed SQL Server in production.
8. Add Redis for distributed rate limits and cache.
9. Add WAF/bot protection at the edge.
10. Load-test before traffic events.

## Product model

Product
- title
- slug
- description
- category
- base price
- compare-at price
- SKU
- active state
- images
- variants

Variant
- SKU
- size
- color
- inventory

Order
- immutable line-item snapshots
- totals
- shipping address snapshot
- payment reference
- status

## Checkout invariants

- Never trust client-side price.
- Recalculate totals server-side.
- Reserve inventory transactionally.
- Use idempotency keys.
- Confirm payment from the payment provider.
- Only then transition order to paid.
- Release expired inventory reservations.

## Acceptance criteria for the first slice

- A shopper can browse products.
- A shopper can filter by category.
- A shopper can open a product.
- A shopper can add a product to a local cart.
- API is GraphQL.
- API reads from SQL Server.
- SQL schema is migration-based.
- App has health/readiness endpoints.
- Unit and E2E smoke tests exist.
