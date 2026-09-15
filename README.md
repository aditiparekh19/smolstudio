# SmolStudio

Production-oriented commerce foundation for **SmolStudio**, inspired by the supplied visual reference:
- warm ivory / cream product photography
- charcoal UI chrome
- espresso/brown typography
- soft rounded cards
- clean editorial babywear storefront

## Stack

- Node.js 24
- TypeScript 7
- Fastify 5
- GraphQL Yoga 5
- `mssql` for SQL Server
- Next.js 16 + React 19
- Tailwind CSS 4
- Vitest + Playwright
- Docker Compose for local SQL Server

The scaffold intentionally keeps the GraphQL layer thin: resolvers call application services, and services call repositories/SQL. That keeps the API replaceable and makes the database boundary testable.

## Local setup

Prerequisites from your current machine:
- Node `v24.21.0` ✅
- npm `11.19.0` ✅
- Docker / Compose ✅

> Your Docker 20.10.x is older than current Docker Desktop releases. It can work for local development, but upgrade Docker Desktop before production.

```bash
cp .env.example .env
npm install

npm run db:up
npm run db:migrate
npm run db:seed

npm run dev
```

Open:
- Web: http://localhost:3000
- GraphQL: http://localhost:4000/graphql
- Health: http://localhost:4000/health

## First feature slice

Implemented:
1. Categories
2. Product catalog
3. Product variants
4. Product images
5. Inventory quantity
6. Homepage product grid
7. Product detail route
8. Local cart state foundation
9. GraphQL catalog queries
10. SQL migration + seed
11. API health/readiness endpoints
12. Security headers + CORS + rate limiting
13. API unit/integration tests
14. Browser E2E smoke test
15. Dockerfiles and GitHub Actions CI

Next slices should be:
- customer accounts / OTP or passwordless auth
- addresses
- cart persistence
- checkout
- Razorpay/Stripe payment abstraction
- orders and order status
- admin catalog
- image uploads to object storage
- coupons
- search
- analytics
- notifications
- returns/refunds

## Production architecture for 1M users

Do **not** scale a single Docker SQL Server container to 1M users.

Recommended target:
- Next.js on Vercel or Azure Front Door + App Service/Container Apps
- Fastify API as stateless containers behind a load balancer
- Azure SQL Database / Managed Instance for production SQL Server
- Redis for hot catalog/cache/session primitives
- Object storage + CDN for product media
- Queue/event bus for emails, stock events, image processing, analytics
- OpenTelemetry + Application Insights/Grafana for traces, metrics and logs
- WAF + bot protection + rate limiting at edge and API
- Read replicas / geo-replication where supported and useful
- Cursor pagination and covering indexes for catalog reads

The application code is designed so these can be added without changing the UI contract.

## Database

Schema is in `apps/api/sql/001_schema.sql`.

Core tables:
- customers
- addresses
- categories
- products
- product_variants
- product_images
- inventory
- carts / cart_items
- orders / order_items
- wishlists
- product_reviews
- coupons
- audit_events

Use migrations rather than modifying production tables manually.

## Git

Inside your existing local repo:

```bash
git add .
git commit -m "chore: bootstrap smolstudio production foundation"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## Design direction

The supplied screenshot is used as a visual reference, not as an asset source. The implementation uses a tokenized palette so the brand can evolve without rewriting components.

Main tokens:
- ink: `#252321`
- espresso: `#5E473C`
- paper: `#FBF7F0`
- cream: `#F3E7D7`
- blush: `#E9D5CC`
- muted: `#8B7A70`

## Important assumptions

The first release assumes:
- India-first commerce
- INR prices
- domestic shipping
- products are baby clothing / accessories
- product photos are stored in object storage in production
- payments are added behind a provider interface rather than hard-coded into order logic

Change these assumptions before implementing checkout.

## Authentication and cart (v0.2)

The current release adds:

- Customer registration, login, logout, and account page.
- Admin/staff login and protected admin dashboard UI.
- HTTP-only, hashed session tokens stored in SQL Server.
- Guest carts backed by SQL Server with a browser-held anonymous cart token.
- Guest-cart merge when a customer registers or logs in.
- Variant/size-aware add-to-bag with server-side stock checks.
- Cart quantity changes and item removal.
- Search navigation and a checkout foundation ready for address/order/payment work.

### Apply the auth migration

After the existing database is running:

```bash
npm run db:migrate
```

The migration runner now applies every numbered SQL migration in `apps/api/sql` in order.

### Create an admin account

From Git Bash on Windows:

```bash
ADMIN_EMAIL=admin@smolstudio.local ADMIN_PASSWORD='ChangeMe123!' npm run db:create-admin --workspace apps/api
```

Use a strong password for any real deployment. The command creates the account if missing, or promotes/resets the matching account if it already exists.

### New routes

- `/login`
- `/register`
- `/logout`
- `/account`
- `/admin/login`
- `/admin`
- `/admin/logout`
- `/search`
- `/cart`
- `/checkout`

## Payments and delivery tracking

SmolStudio now includes a Razorpay Standard Checkout flow. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to the API environment. The server creates the Razorpay order, the browser opens Razorpay Checkout, and the server verifies the returned signature before marking the local order paid. Razorpay test keys should be used during development.

Optional Google Maps support is available with `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in the web environment and `GOOGLE_MAPS_API_KEY` in the API environment. Without a Maps key, checkout and order pages still provide a Google Maps search link. Admins can add a carrier, tracking number, and tracking URL to an order; customers then see a delivery-status timeline and tracking link in Account → Orders.

After applying the new migration, restart the API and web apps. The migration runner automatically applies `004_orders_payments_tracking.sql`.
