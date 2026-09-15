# SmolStudio architecture

```text
                         ┌───────────────────────────┐
                         │ CDN / WAF / Edge          │
                         └─────────────┬─────────────┘
                                       │
                        ┌──────────────▼──────────────┐
                        │ Next.js storefront          │
                        │ React + Tailwind             │
                        └──────────────┬──────────────┘
                                       │ GraphQL HTTPS
                        ┌──────────────▼──────────────┐
                        │ Fastify API                  │
                        │ GraphQL Yoga                 │
                        │ rate limit / auth / logging  │
                        └──────────────┬──────────────┘
                                       │
                        ┌──────────────▼──────────────┐
                        │ Application services         │
                        │ catalog / cart / order /     │
                        │ payment / inventory          │
                        └──────────────┬──────────────┘
                                       │ mssql
                        ┌──────────────▼──────────────┐
                        │ SQL Server                   │
                        └─────────────────────────────┘
```

## Why GraphQL

GraphQL gives the storefront a stable contract as the domain grows. The API should remain domain-oriented rather than exposing SQL tables directly.

## Why not an ORM yet?

For a SQL Server commerce system, the first foundation uses parameterized `mssql` queries. This makes SQL/index behavior explicit and avoids introducing an ORM before the domain stabilizes.

An ORM can be added later if it improves developer velocity, but the service/repository boundary should remain.

## Cache strategy

Phase 1:
- Next.js revalidation for public product pages
- HTTP cache headers
- CDN media

Phase 2:
- Redis cache for catalog/category responses
- cache invalidation on product/inventory mutation

Phase 3:
- event-driven cache invalidation
- regional caches if needed

## Database strategy

Local:
- Docker SQL Server Developer edition

Production:
- managed SQL Server
- automated backups
- point-in-time restore
- read scaling / replicas where supported
- separate migration identity from application identity

## Observability

Every request should have:
- request id
- user/customer id when authenticated
- operation name
- latency
- status
- error class

Add OpenTelemetry before the first major traffic campaign.
