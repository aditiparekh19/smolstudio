# SmolStudio

A production-oriented, full-stack ecommerce platform for **SmolStudio**, built for an India-first babywear/lifestyle storefront.

SmolStudio combines a warm editorial storefront with a complete commerce backend covering products, variants, inventory, customer accounts, carts, wishlist, reviews, coupons, checkout, payments, orders, delivery tracking, returns, replacements, refunds/store credit, and admin operations.

The visual direction is inspired by:

* Warm ivory / cream product photography
* Charcoal UI chrome
* Espresso/brown typography
* Soft rounded cards
* Clean editorial layouts
* Minimal, premium babywear storefront aesthetics

---

## Table of Contents

* [Tech Stack](#tech-stack)
* [Architecture](#architecture)
* [Repository Structure](#repository-structure)
* [Current Feature Set](#current-feature-set)
* [Storefront](#storefront)
* [Catalog](#catalog)
* [Inventory](#inventory)
* [Authentication](#authentication)
* [Password Reset](#password-reset)
* [Cart](#cart)
* [Wishlist](#wishlist)
* [Product Reviews](#product-reviews)
* [Checkout](#checkout)
* [Coupons](#coupons)
* [Payments](#payments)
* [Orders](#orders)
* [Shipping & Tracking](#shipping--tracking)
* [Returns & Replacements](#returns--replacements)
* [Return Fees](#return-fees)
* [Refunds & Store Credit](#refunds--store-credit)
* [Admin / Back Office](#admin--back-office)
* [GraphQL API](#graphql-api)
* [Security](#security)
* [Database](#database)
* [Environment Configuration](#environment-configuration)
* [Local Development](#local-development)
* [Build & Verification](#build--verification)
* [Development Guidelines](#development-guidelines)
* [Git](#git)
* [Design System](#design-system)
* [Project Status](#project-status)

---

# Tech Stack

## Frontend

* **Next.js 16.3.4**
* **React 19**
* **TypeScript**
* **Tailwind CSS 4**
* Next.js App Router
* Turbopack
* GraphQL client utilities
* `canvas-confetti`

## Backend

* **Node.js 24**
* **TypeScript**
* **Fastify 5**
* **GraphQL Yoga 5**
* GraphQL
* `mssql`
* SQL Server
* `scrypt` password hashing
* HTTP-only session authentication

## Database

* **Microsoft SQL Server**
* Docker-based local SQL Server
* Database: `smolstudio`

Local development currently uses:

```text
Host port:      1434
Container port: 1433
```

## Payments

* **Razorpay Standard Checkout**
* Server-side payment order creation
* Server-side signature verification
* Payment status management
* Refund workflow

## Email

* **Resend**
* Password-reset emails
* Order/status notification infrastructure

## Testing

* **Vitest**
* **Playwright**

## Infrastructure

* Docker
* Docker Compose
* npm workspaces
* GitHub Actions CI
* Environment-based configuration

---

# Architecture

SmolStudio is organized as a TypeScript monorepo.

The application intentionally keeps the GraphQL layer thin:

```text
Next.js Web App
      │
      │ GraphQL
      ▼
Fastify + GraphQL Yoga
      │
      ▼
Application Services
      │
      ▼
SQL Server
```

Resolvers primarily:

1. Authenticate/authorize the request
2. Validate GraphQL input
3. Call an application service

Business logic lives in backend services rather than inside React components or GraphQL resolvers.

This keeps:

* Business rules centralized
* Database access testable
* Frontend replaceable
* Payment/order logic server-authoritative
* Future REST/API alternatives possible

---

# Repository Structure

```text
smolstudio/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── cart/
│   │   │   ├── email/
│   │   │   ├── graphql/
│   │   │   ├── orders/
│   │   │   ├── notifications/
│   │   │   └── ...
│   │   ├── sql/
│   │   └── ...
│   │
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   │   ├── account/
│       │   │   ├── admin/
│       │   │   ├── checkout/
│       │   │   ├── login/
│       │   │   ├── register/
│       │   │   ├── reset-password/
│       │   │   └── ...
│       │   ├── components/
│       │   └── lib/
│       └── ...
│
├── docker-compose.yml
├── package.json
└── README.md
```

---

# Current Feature Set

SmolStudio currently covers the following commerce lifecycle:

```text
Product Catalog
      ↓
Variants & Inventory
      ↓
Customer Accounts
      ↓
Cart
      ↓
Wishlist
      ↓
Reviews
      ↓
Coupons
      ↓
Checkout
      ↓
Shipping / GST
      ↓
Razorpay / Store Credit
      ↓
Orders
      ↓
Shipping / Tracking
      ↓
Delivery
      ↓
Returns / Replacements
      ↓
Refund / Store Credit
      ↓
Admin Operations
```

---

# Storefront

The customer storefront includes:

* Homepage
* Hero section
* Product grid
* Product detail pages
* Category browsing
* Search
* Responsive navigation
* Product imagery
* Pricing
* Stock information
* Journal/content section
* Contact/account navigation
* Responsive desktop/mobile layouts

The storefront uses a warm, editorial visual system rather than a generic ecommerce template.

---

# Catalog

Products support:

* Product name
* SKU
* Slug
* Description
* Price
* Compare-at price
* Active/draft state
* Category
* Product images
* Product variants
* Size
* Color
* Variant SKU

Product images support:

* Primary image
* Sort order
* Alt text
* Storage key
* Multiple images per product

Admin users can create, edit and delete products and manage their associated variants and images.

---

# Inventory

Inventory is maintained at the variant level.

Available inventory is calculated using:

```text
quantity_available - quantity_reserved
```

The system validates stock server-side when products are added to the cart and during checkout/payment workflows.

Inventory reservations prevent stock from remaining permanently locked while a customer is completing payment.

---

# Authentication

Customer authentication supports:

* Registration
* Login
* Logout
* Account page
* HTTP-only sessions
* Hashed session tokens
* Password hashing
* Authenticated GraphQL requests

Admin/staff access is role protected.

The backend remains responsible for authorization; hiding a frontend route does not constitute authorization.

---

# Password Reset

Password recovery is implemented through a tokenized reset workflow:

```text
Forgot password
      ↓
Generate reset token
      ↓
Hash/store token
      ↓
Send reset email
      ↓
Customer opens reset link
      ↓
Validate token
      ↓
Set new password
      ↓
Consume token
```

Reset tokens are stored separately from user passwords.

The `/reset-password` page reads the token from the URL and uses a React `Suspense` boundary around `useSearchParams()` so the page can successfully build with Next.js production rendering.

---

# Cart

The cart supports:

* Guest carts
* Authenticated carts
* Browser-held anonymous cart token
* SQL-backed cart persistence
* Cart merging after login/register
* Variant-aware items
* Quantity updates
* Item removal
* Stock validation
* Cart clearing after successful order creation

The backend prevents invalid stock quantities and duplicate cart records.

---

# Wishlist

Customers can:

* Add products to wishlist
* Remove products from wishlist
* View wishlist state

Admin product activity includes a wishlist count based on distinct customers.

---

# Product Reviews

Product reviews support:

* Customer/product association
* Ratings
* Published/unpublished reviews
* Product-level review display

A database uniqueness rule prevents duplicate reviews by the same customer for the same product:

```text
(product_id, customer_id)
```

The current admin product activity system uses published 4–5 star reviews for its **Liked** metric.

---

# Checkout

Checkout is server-authoritative.

It calculates:

* Cart subtotal
* Coupon discount
* Taxable amount
* GST
* Shipping
* Final total
* Payment amount

The GraphQL API exposes:

```text
checkoutTotals(couponCode: String)
```

The browser does not have authority over the final amount.

Checkout also performs customer/address validation and phone validation.

The current phone UI validation expects an Indian mobile number beginning with `6–9` and normalizes the value to 10 digits.

---

# Shipping

The current business rule is:

```text
Taxable amount <= ₹499
    → ₹80 shipping

Taxable amount >= ₹500
    → Free shipping
```

The values are configurable through environment variables.

Development configuration has used:

```env
SHIPPING_FLAT_INR=0
FREE_SHIPPING_THRESHOLD_INR=0
```

Production values should be configured through the deployment environment.

The checkout also provides free-shipping feedback and celebration/confetti when free shipping is applied.

---

# GST

GST is calculated by the backend.

Configuration:

```env
GST_RATE_PERCENT=0
```

The current development environment uses a zero GST rate, while the application remains configurable for a production rate.

---

# Coupons

Coupon validation is performed by the API.

Supported coupon capabilities include:

* Percentage discounts
* Minimum order values
* Maximum redemptions
* Start dates
* Expiry dates
* Category eligibility
* First-time-buyer promotions

The first-time buyer promotion is designed around:

```text
WELCOME5
```

with a 5% discount.

Coupons are passed through both checkout calculation and payment-order creation.

The frontend does not independently determine whether a coupon is valid.

---

# Payments

## Razorpay

SmolStudio uses Razorpay Standard Checkout.

The workflow is:

```text
Customer checkout
      ↓
Create local/payment order
      ↓
Create Razorpay order
      ↓
Open Razorpay Checkout
      ↓
Customer pays
      ↓
Receive Razorpay response
      ↓
Verify signature server-side
      ↓
Finalize local order
      ↓
Clear cart
      ↓
Send notification
```

The browser's payment callback is not treated as authoritative.

The server verifies the Razorpay signature before marking the local payment/order as successful.

Development should use Razorpay test credentials.

---

# Orders

Orders contain:

* Customer
* Delivery address
* Order items
* Quantities
* Pricing
* Discounts
* Shipping
* GST
* Payment information
* Order status
* Shipment/tracking information

Typical order lifecycle:

```text
PAID
  ↓
PROCESSING
  ↓
SHIPPED
  ↓
DELIVERED
```

Other states include cancellation and refund-related states.

Payment/refund state is maintained separately from the primary order lifecycle.

---

# Shipping & Tracking

Admin can associate shipping information with an order:

* Carrier
* AWB/tracking number
* Tracking URL

Customers can see shipping/delivery information from their account order page.

Google Maps support is optional.

Without a Maps API key, checkout/order pages can still provide a Google Maps search link.

---

# Returns & Replacements

SmolStudio supports a partial after-sales workflow inspired by modern fashion ecommerce.

Supported request types:

```text
PRODUCT_FAULT
SIZE_REPLACEMENT
```

Only delivered orders are eligible.

Partial quantities are supported.

For example:

```text
Purchased quantity: 5
Return/replacement quantity: 2
Remaining quantity: 3
```

The customer does not have to return the entire order-item quantity.

---

# Product-Fault Complaints

`PRODUCT_FAULT` represents a genuine product issue.

A product-fault request requires:

* Delivered order
* Valid order item
* Valid requested quantity
* Reason
* 1–3 supporting images

Product-fault requests are processed through the admin after-sales workflow.

---

# Size Replacements

`SIZE_REPLACEMENT` is intentionally separate from product complaints.

It represents a customer-requested size change, including cases where the customer selected the wrong size.

Therefore:

* Size replacement is **not** a product complaint
* Size replacement does **not** incur the product-fault return fee
* Size replacement does **not** consume the product-fault free-return allowance
* Replacement size/variant must be validated
* Replacement stock must be available
* Partial size replacements are supported

The Size Replacements metric has been removed from the current admin Products interface.

---

# Partial Return Quantities

After-sales requests use:

```text
return_quantity
```

The backend validates:

```text
1 <= return_quantity <= purchased quantity
```

Previously requested quantities are also considered so that overlapping active requests cannot exceed the quantity purchased.

This allows:

```text
Order item quantity = 5

Request 1 = 2
Request 2 = 3
```

while preventing requests that exceed the original quantity.

---

# Return Fees

Current product-fault return-fee policy:

```text
First 2 eligible product-fault returned items
    → Free

3rd item onward
    → ₹100 per item
```

The fee is based on:

```text
return_quantity
```

not the original order-item quantity.

Size replacements are excluded.

The fee configuration is:

```env
RETURN_FEE_THRESHOLD=2
RETURN_FEE_INR=100
```

The request records:

```text
return_fee_inr
return_fee_status
return_fee_order_id
return_fee_payment_id
return_fee_paid_at
```

Fee status includes:

```text
PENDING
NOT_REQUIRED
```

The system calculates the fee at request creation time so the applicable fee is preserved with the request.

---

# Return Fee Eligibility

Eligible historical product-fault quantities are calculated using the return request quantity.

The fee allowance is based on qualifying return requests rather than simply counting order items.

Size replacements do not contribute to the allowance.

Rejected and cancelled requests do not contribute to the eligible quantity.

---

# Return Paid Amount

For partial returns, the backend calculates the paid amount for the requested quantity.

Order-level discounts are allocated proportionally to the affected order item.

The calculation considers:

* Original item total
* Order subtotal
* Order-level discount
* Purchased quantity
* Requested return quantity

This prevents a customer from receiving an incorrect refund amount simply because the original order contained multiple products or an order-level discount.

---

# After-Sales Statuses

The after-sales workflow supports states including:

```text
REQUESTED
APPROVED
PROCESSING
PICKUP_ASSIGNED
COMPLETED
REJECTED
CANCELLED
```

Active-request validation prevents overlapping requests.

Rejected/cancelled requests are excluded from return-fee eligibility calculations.

---

# Refunds & Store Credit

The application contains refund/store-credit infrastructure for after-sales workflows.

The intended business flow is:

```text
Approved return
      ↓
Calculate eligible paid amount
      ↓
Calculate return fee
      ↓
Deduct applicable fee
      ↓
Issue remaining amount as store credit
```

Payment/refund status is tracked separately from the order status.

---

# Admin / Back Office

Admin/staff users have access to protected back-office functionality.

Current areas include:

* Admin dashboard
* Product management
* Product creation
* Product editing
* Product deletion
* Product images
* Product variants
* Inventory
* Orders
* Order management
* Shipping/tracking
* After-sales workflow
* Customer/account administration

Admin access is enforced by backend role checks.

---

# Admin Product Activity

The Admin Products page currently shows:

```text
Liked
Wishlisted
Complaints
```

## Liked

Based on published 4–5 star product reviews.

## Wishlisted

Based on distinct customers who have wishlisted the product.

## Complaints

A complaint is counted **only** when:

```sql
request_type = 'PRODUCT_FAULT'
AND status = 'COMPLETED'
```

Therefore:

```text
COMPLETED PRODUCT_FAULT
    → Complaint

APPROVED PRODUCT_FAULT
    → Not yet a complaint

PROCESSING PRODUCT_FAULT
    → Not a complaint

PICKUP_ASSIGNED PRODUCT_FAULT
    → Not a complaint

REQUESTED PRODUCT_FAULT
    → Not a complaint

REJECTED PRODUCT_FAULT
    → Not a complaint

CANCELLED PRODUCT_FAULT
    → Not a complaint

SIZE_REPLACEMENT
    → Never a complaint
```

The product relationship is resolved through:

```text
return_requests
      ↓ order_item_id
order_items
      ↓ variant_id
product_variants
      ↓ product_id
products
```

This ensures the complaint is attributed to the actual product involved.

---

# GraphQL API

The API uses GraphQL Yoga on Fastify.

Representative operations include:

## Catalog

```text
products
categories
adminProducts
adminProduct
```

## Cart

```text
cart
addToCart
updateCartItem
removeFromCart
```

## Checkout

```text
checkoutTotals
previewAfterSalesFee
eligibleProductFaultReturnQuantity
createPaymentOrder
verifyPayment
```

## Authentication

```text
register
login
logout
forgotPassword
resetPassword
```

## Orders

```text
orders
order
adminOrders
```

## After-sales

```text
requestItemAfterSales
```

The current GraphQL schema is the authoritative source for the complete API.

---

# Security

Security measures include:

* HTTP-only authentication cookies
* Hashed session tokens
* `scrypt` password hashing
* Backend authorization
* Admin/staff role checks
* CORS configuration
* Security headers
* Rate limiting
* Server-side coupon validation
* Server-side payment verification
* Inventory validation
* Inventory reservations
* Order ownership checks
* Delivered-order validation for returns
* Return quantity validation
* Active-request conflict checks
* Password-reset token expiration/consumption
* Product-fault image validation

Example development rate limit:

```env
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW=1 minute
```

Security-sensitive business rules should never rely exclusively on frontend validation.

---

# Database

The database is Microsoft SQL Server.

Important tables include:

```text
customers
addresses

categories
products
product_variants
product_images
inventory

sessions
password_reset_tokens

carts
cart_items

wishlists
wishlist_items

product_reviews

orders
order_items

return_requests
return_request_images

coupons
coupon_categories

audit_events
```

Additional payment/store-credit tables may exist in the current schema.

The authoritative schema is maintained under:

```text
apps/api/sql/
```

---

# Database Migrations

The migration runner applies numbered SQL migrations in order.

Run:

```bash
npm run db:migrate
```

Do not manually modify production tables when a migration should be used.

The database has already received changes for functionality including:

* Authentication
* Orders
* Payments
* Tracking
* Reviews
* Return quantities
* Return-fee fields
* Review uniqueness
* Other commerce workflows

---

# Monetary Data

GraphQL money fields that may contain decimal rupee values use `Float` where appropriate.

This prevents GraphQL serialization problems for values such as:

```text
₹24.95
₹474.05
₹124.95
```

Payment-provider amounts that must be represented as integer paise continue to follow Razorpay's contract.

Money calculations remain server-side.

---

# Environment Configuration

Typical development configuration:

```env
API_PORT=4000
CORS_ORIGIN=http://localhost:3000
PUBLIC_API_URL=http://localhost:4000

DATABASE_HOST=127.0.0.1
DATABASE_PORT=1434
DATABASE_NAME=smolstudio
DATABASE_USER=sa
DATABASE_ENCRYPT=false
DATABASE_TRUST_SERVER_CERT=true

RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW=1 minute

GST_RATE_PERCENT=0
SHIPPING_FLAT_INR=0
FREE_SHIPPING_THRESHOLD_INR=0

PAYMENT_RESERVATION_MINUTES=15

RETURN_FEE_THRESHOLD=2
RETURN_FEE_INR=100

RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...

RESEND_API_KEY=...

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
GOOGLE_MAPS_API_KEY=...
```

Do not commit real credentials or API secrets to Git.

---

# Local Development

## Prerequisites

Current development environment:

```text
Node.js 24
npm 11
Docker
Docker Compose
```

Verify:

```bash
node -v
npm -v
docker --version
docker compose version
```

---

## Install dependencies

From the repository root:

```bash
npm install
```

---

## Start SQL Server

Start the Docker services:

```bash
docker compose up -d
```

The local SQL Server container is:

```text
smolstudio-sqlserver
```

with:

```text
Host:      1434
Container: 1433
```

---

## Run migrations

```bash
npm run db:migrate
```

---

## Seed development data

If the project seed command is configured:

```bash
npm run db:seed
```

---

## Start development

Run the root development command:

```bash
npm run dev
```

Or start the workspaces independently:

```bash
npm run dev --workspace apps/api
```

and:

```bash
npm run dev --workspace apps/web
```

---

# Local URLs

Frontend:

```text
http://localhost:3000
```

GraphQL:

```text
http://localhost:4000/graphql
```

Health:

```text
http://localhost:4000/health
```

---

# Admin Account

A development admin account can be created using the project's admin creation script.

Example:

```bash
ADMIN_EMAIL=admin@smolstudio.local \
ADMIN_PASSWORD='ChangeMe123!' \
npm run db:create-admin --workspace apps/api
```

Use a strong password for real environments.

---

# Build & Verification

Build everything:

```bash
npm run build
```

Build API:

```bash
npm run build --workspace apps/api
```

Build web:

```bash
npm run build --workspace apps/web
```

The API build uses TypeScript:

```text
tsc -p tsconfig.json
```

The web build uses:

```text
next build
```

A successful production build is an important verification step after changes to:

* GraphQL
* API services
* Database-facing code
* Authentication
* Checkout
* Orders
* Returns
* Admin pages

---

# Development Guidelines

## Keep business logic server-side

Do not trust the frontend for:

* Final prices
* Discounts
* Coupons
* Inventory
* Payment success
* Refund values
* Return eligibility
* Return fees
* Authorization

The browser is a client, not the source of truth.

---

## Keep GraphQL resolvers thin

Preferred pattern:

```text
GraphQL Resolver
      ↓
Service
      ↓
Database
```

Avoid putting large SQL/business workflows directly into resolvers.

---

## Validate database state

For important changes, verify both:

1. GraphQL/API response
2. SQL/database state

For example, when changing complaint calculations, verify:

```text
Database count
      ↓
GraphQL count
      ↓
Admin UI count
```

---

## Use migrations

Database changes should be represented as numbered migrations.

Avoid ad-hoc production schema changes.

---

# Important Development Note

During development, the project has at times had both:

```text
Docker API
```

and:

```text
Windows-terminal API
```

running simultaneously.

This can cause confusing situations where a code change appears not to work because a different API process is serving port `4000`.

When debugging GraphQL behavior, verify the process/container actually serving:

```text
http://localhost:4000/graphql
```

The intended local architecture is:

```text
Next.js
localhost:3000
      │
      │ GraphQL
      ▼
Fastify + GraphQL Yoga
localhost:4000
      │
      ▼
SQL Server
Docker
1434 → 1433
```

---

# Design System

The visual system is based on a warm editorial aesthetic.

Current core tokens include:

```text
ink      #252321
espresso #5E473C
paper    #FBF7F0
cream    #F3E7D7
blush    #E9D5CC
muted    #8B7A70
```

The UI emphasizes:

* Cream backgrounds
* Espresso typography
* Rounded cards
* Rounded buttons
* Serif display headings
* Soft borders
* Editorial spacing
* Product photography
* Minimal interface chrome

The supplied visual reference is treated as a design reference rather than an asset source.

---

# Current Routes

Representative customer routes include:

```text
/
 /search
 /login
 /register
 /logout
 /account
 /account/orders
 /checkout
 /cart
 /reset-password
```

Representative admin routes include:

```text
/admin
/admin/login
/admin/logout
/admin/products
/admin/products/new
/admin/products/[id]
```

The exact current route tree is defined by the Next.js application.

---

# Current Project Status

SmolStudio has progressed substantially beyond the original commerce foundation.

The project currently includes:

### Catalog

* Categories
* Products
* Variants
* Product images
* Inventory
* Product detail pages
* Admin product management

### Customer

* Registration
* Login
* Logout
* Account
* Password reset
* Persistent carts
* Guest carts
* Cart merging
* Wishlist
* Reviews

### Commerce

* Checkout
* Coupon validation
* First-time buyer promotion infrastructure
* Shipping calculation
* GST calculation
* Razorpay payments
* Store credit
* Order creation
* Payment verification

### Fulfillment

* Order statuses
* Carrier information
* AWB/tracking number
* Tracking URL
* Delivery timeline

### After-sales

* Partial returns
* Partial replacements
* Product-fault complaints
* Size replacements
* Product-fault evidence images
* Replacement-size validation
* Return quantity tracking
* Return-fee calculation
* Refund/store-credit infrastructure

### Admin

* Protected admin/staff access
* Product management
* Product activity metrics
* Order management
* Shipping/tracking management
* After-sales operations

---

# Business Rules Summary

## Shipping

```text
Taxable amount <= ₹499
→ ₹80 shipping

Taxable amount >= ₹500
→ Free shipping
```

## Product-fault return fee

```text
First 2 eligible items
→ Free

3rd item onward
→ ₹100/item
```

## Size replacement

```text
Customer size choice
→ No product-fault fee
→ Not a complaint
→ Does not consume complaint return allowance
```

## Complaint metric

```text
PRODUCT_FAULT + COMPLETED
→ Counted as complaint
```

## Product-fault evidence

```text
1–3 images
```

## After-sales eligibility

```text
DELIVERED orders only
```

## Partial quantity

```text
Requested quantity
≤
Purchased quantity
```

---

# Git

Initial repository setup:

```bash
git add .
git commit -m "chore: bootstrap smolstudio production foundation"

git branch -M main

git remote add origin <YOUR_GITHUB_REPO_URL>

git push -u origin main
```

For subsequent work:

```bash
git add .
git commit -m "feat: <describe change>"
git push
```

Never commit:

```text
.env
API secrets
Razorpay secret keys
Database passwords
Private credentials
```

---

# License

This project is proprietary/private unless a separate license is added by the project owner.

---

# SmolStudio

A thoughtfully designed ecommerce platform built around the complete customer journey:

```text
DISCOVER
   ↓
SHOP
   ↓
CART
   ↓
CHECKOUT
   ↓
PAY
   ↓
DELIVER
   ↓
RETURN / REPLACE
   ↓
RESOLVE
```

The application is designed to keep the customer experience simple while enforcing critical commerce rules securely at the API and database layers.
