# SmolStudio - Deployment Plan

## 1. Deployment Goal

We will initially deploy SmolStudio for approximately **5,000 registered users**.

Our first production deployment will focus on:

* Stable ecommerce website
* Customer registration and login
* Product catalogue
* Cart and wishlist
* Checkout
* Razorpay payments
* Coupons
* Orders
* Shipping and tracking
* Returns and replacements
* Refunds and store credit
* Admin panel
* Transactional emails
* Product image storage
* Database backups
* Basic monitoring and security

We will start with a simple AWS architecture and increase capacity only when our actual traffic requires it.

We will use:

* **GoDaddy** for the domain
* **AWS** for application and database hosting
* **Razorpay** for payments
* **Resend** for transactional emails
* **GitHub** for source code and deployment
* **Amazon S3** for product images
* **CloudFront** for image delivery
* **CloudWatch** for monitoring

---

# 2. Overall Architecture

Our production architecture will be:

```text
Customer
   |
   v
GoDaddy Domain
   |
   v
AWS
   |
   +----------------------+
   |                      |
   v                      v
Next.js Web App       Fastify GraphQL API
   |                      |
   +----------+-----------+
              |
              v
       Amazon RDS
       SQL Server
              |
       +------+------+
       |      |      |
       v      v      v
      S3  Razorpay Resend
       |
       v
   CloudFront
```

We will keep the application server and database separate.

Our application will run on AWS EC2.

Our SQL Server database will run on Amazon RDS.

We will **not** run SQL Server inside Docker in production.

---

# 3. Services We Will Use

| Service             | Purpose                           |
| ------------------- | --------------------------------- |
| GoDaddy             | Domain                            |
| AWS EC2             | Next.js + Fastify application     |
| AWS RDS             | Production SQL Server             |
| AWS S3              | Product images and uploaded files |
| AWS CloudFront      | Image/content delivery            |
| AWS CloudWatch      | Monitoring and logs               |
| AWS IAM             | Access control                    |
| AWS VPC             | Private networking                |
| AWS Security Groups | Firewall                          |
| Razorpay            | Online payments                   |
| Resend              | Transactional emails              |
| GitHub              | Source code and CI/CD             |

---

# 4. GoDaddy

We will use GoDaddy only for our domain.

For example:

```text
smolstudio.com
```

We will not purchase GoDaddy hosting because our application is built with Next.js, Fastify and SQL Server and we will host the application on AWS.

Our GoDaddy requirement will therefore be:

```text
Domain
```

We will configure the DNS records required to connect our domain to AWS.

### Expected cost

We will budget approximately:

```text
₹1,000 – ₹2,500 per year
```

The actual amount will depend on the domain extension, promotional pricing and renewal price.

---

# 5. AWS Region

Since our initial customers will primarily be in India, we will use:

```text
AWS Mumbai
ap-south-1
```

This will keep our application and database infrastructure close to our primary customer base.

---

# 6. AWS EC2

We will initially use one EC2 server to run our application.

The initial server will be approximately:

```text
EC2
2 vCPU
4 GB RAM
Linux
```

We will start with a suitable AWS instance such as:

```text
t3.medium
```

The server will run:

```text
Docker
Docker Compose
Nginx
Next.js
Fastify API
```

Our initial structure will be:

```text
EC2
 |
 +-- Nginx
 |
 +-- Next.js
 |
 +-- Fastify API
```

We will keep the application ports internal and expose only HTTPS through Nginx.

### Estimated cost

We will budget approximately:

```text
₹3,000 – ₹4,500/month
```

for the initial EC2 compute.

Storage and data transfer may add additional cost depending on usage.

---

# 7. Production Docker Setup

We will continue using Docker for the application.

Production will contain:

```text
web
api
nginx
```

We will create a production Docker Compose configuration separate from our local development configuration.

We will not include SQL Server in the production Docker Compose file.

The production database will be Amazon RDS.

---

# 8. Amazon RDS - SQL Server

Our application already uses Microsoft SQL Server, so we will continue using SQL Server in production.

We will create:

```text
Amazon RDS
Microsoft SQL Server
```

Our initial database will be:

```text
Database:
smolstudio
```

The RDS database will be private and will only accept connections from our application server.

We will not expose SQL Server directly to the internet.

---

# 9. Initial RDS Configuration

We will start with:

```text
SQL Server
Single-AZ
General Purpose SSD
20–50 GB storage
Automated backups enabled
Encryption enabled
Private access
```

We will initially evaluate SQL Server Express if it is sufficient for our database size and workload.

If Express becomes unsuitable, we will move to an appropriate paid SQL Server edition.

---

# 10. RDS Backup

We will enable automated backups.

Initial backup retention:

```text
7 days
```

Before important database migrations, we will also create a manual snapshot.

Our migration process will be:

```text
Create backup
     |
     v
Run migration
     |
     v
Verify database
     |
     v
Deploy API
     |
     v
Run application tests
```

We will not make important production schema changes without a recoverable backup.

---

# 11. Estimated RDS Cost

The SQL Server database will be one of the larger parts of our AWS bill.

For initial planning, we will budget:

```text
₹1,500 – ₹4,000/month
```

if SQL Server Express is suitable.

If we need a paid SQL Server edition, the cost can increase substantially.

We will use the AWS Pricing Calculator before finalizing the production RDS instance.

---

# 12. AWS S3

We will store product images in Amazon S3.

We will not store production product images:

* inside the Next.js project
* inside the EC2 filesystem
* directly inside SQL Server

Our structure will be approximately:

```text
S3
 |
 +-- products
 |    |
 |    +-- product-1
 |    +-- product-2
 |    +-- product-3
 |
 +-- returns
      |
      +-- order/request files
```

S3 will be configured as a private bucket.

We will use encryption and appropriate IAM permissions.

---

# 13. CloudFront

We will use Amazon CloudFront to serve product images efficiently.

Our image flow will be:

```text
S3
 |
 v
CloudFront
 |
 v
Customer
```

This will reduce the amount of image traffic directly served by our EC2 server.

We will also optimize images before serving them to customers.

Where appropriate, we will use:

```text
WebP
AVIF
```

instead of unnecessarily large original images.

---

# 14. Estimated S3 + CloudFront Cost

Initially we expect these costs to be relatively small.

We will budget approximately:

```text
S3:
₹100 – ₹500/month

CloudFront:
₹0 – ₹1,500/month
```

The actual amount will depend on:

* number of products
* number of images
* image sizes
* customer traffic
* monthly data transfer

---

# 15. Domain Structure

We will use:

```text
smolstudio.com
```

for the customer-facing website.

We will use:

```text
api.smolstudio.com
```

for the GraphQL API.

The final structure will be:

```text
https://smolstudio.com
https://www.smolstudio.com
https://api.smolstudio.com
```

---

# 16. HTTPS

Our production application will use HTTPS everywhere.

We will not use plain HTTP for:

* login
* customer accounts
* checkout
* payment
* password reset
* admin
* API requests

Our final URLs will be:

```text
https://smolstudio.com
https://api.smolstudio.com
```

---

# 17. Nginx

Nginx will sit in front of our application.

The flow will be:

```text
Internet
   |
   v
Nginx :443
   |
   +----> Next.js
   |
   +----> Fastify API
```

Nginx will handle:

* HTTPS
* HTTP to HTTPS redirect
* reverse proxy
* security headers
* request handling

We will not expose the Next.js and API ports directly to the internet.

---

# 18. AWS Security Groups

Our EC2 security group will allow:

```text
80   HTTP
443  HTTPS
22   SSH - restricted
```

We will not publicly expose:

```text
3000
4000
1433
```

Our RDS security group will allow SQL Server connections only from the EC2 application server.

Therefore:

```text
Internet
   |
   v
EC2
   |
   v
RDS
```

and not:

```text
Internet
   |
   v
RDS
```

---

# 19. AWS IAM

We will use IAM to control access to AWS resources.

We will not use the AWS root account for normal operations.

The root account will have MFA enabled.

The application will use an appropriate IAM role for access to S3 and other AWS services where required.

We will never commit AWS credentials into GitHub.

---

# 20. Production Environment Variables

We will create separate production environment variables.

Our development configuration such as:

```text
localhost
127.0.0.1
Docker SQL Server
test Razorpay keys
```

will not be used in production.

Production will contain values similar to:

```env
NODE_ENV=production

API_PORT=4000

PUBLIC_API_URL=https://api.smolstudio.com
CORS_ORIGIN=https://smolstudio.com

DATABASE_HOST=<RDS-ENDPOINT>
DATABASE_PORT=1433
DATABASE_NAME=smolstudio
DATABASE_USER=<PRODUCTION-USER>
DATABASE_PASSWORD=<PRODUCTION-PASSWORD>

DATABASE_ENCRYPT=true
DATABASE_TRUST_SERVER_CERT=false

RAZORPAY_KEY_ID=<LIVE-KEY>
RAZORPAY_KEY_SECRET=<LIVE-SECRET>

RESEND_API_KEY=<PRODUCTION-KEY>
RESEND_FROM_EMAIL=<VERIFIED-EMAIL>

AWS_REGION=ap-south-1
S3_BUCKET=<PRODUCTION-BUCKET>

GST_RATE_PERCENT=0
SHIPPING_FLAT_INR=80
FREE_SHIPPING_THRESHOLD_INR=500

PAYMENT_RESERVATION_MINUTES=15
```

The exact variables will follow the application's existing configuration.

---

# 21. Razorpay

We will use Razorpay for customer payments.

Razorpay will not be treated as a fixed monthly hosting subscription.

The current standard pricing is generally:

```text
2% platform fee
+ applicable GST
```

Razorpay also lists:

```text
₹0 setup fee
₹0 annual maintenance fee
```

for its standard payment gateway offering.

Some payment methods can have different pricing.

---

# 22. Razorpay Payment Flow

Our payment flow will remain server controlled:

```text
Customer
   |
   v
SmolStudio Checkout
   |
   v
Fastify API
   |
   v
Create Razorpay Order
   |
   v
Razorpay Checkout
   |
   v
Customer Payment
   |
   v
Razorpay
   |
   v
Payment Verification
   |
   v
SmolStudio API
   |
   v
Order marked PAID
```

We will never trust only the frontend payment response.

The server will verify the payment signature before marking an order as paid.

---

# 23. Razorpay Production Setup

Before launch we will:

* complete Razorpay account/KYC requirements
* activate production mode
* create live API keys
* configure webhooks where required
* test payment success
* test payment failure
* test payment cancellation
* test signature verification
* test refunds
* test partial refunds where applicable

We will keep Razorpay test credentials completely separate from production credentials.

---

# 24. Razorpay Cost Example

If our monthly sales are:

```text
₹1,00,000
```

at a 2% platform fee:

```text
₹2,000
```

before applicable GST and other applicable charges.

If our monthly sales become:

```text
₹5,00,000
```

the 2% base fee would be:

```text
₹10,000
```

before applicable taxes and payment-method-specific charges.

Our actual Razorpay bill will therefore depend on our sales volume rather than the number of registered users.

---

# 25. Resend

We will use Resend for transactional emails.

Emails will include:

* registration/welcome
* password reset
* order confirmation
* payment confirmation
* shipping notification
* delivery notification
* return request
* return approval/rejection
* refund/store credit notification

---

# 26. Resend Pricing

We will initially use the Resend Free plan.

Current pricing:

```text
Free
$0/month
3,000 emails/month
100 emails/day
3 domains
```

If our email requirements increase, we will move to:

```text
Pro
$20/month
50,000 emails/month
```

Resend currently lists additional paid usage at $0.90 per 1,000 emails above the included Pro volume.

---

# 27. Resend Production Domain

We will verify our domain:

```text
smolstudio.com
```

with Resend.

We can use addresses such as:

```text
support@smolstudio.com
orders@smolstudio.com
noreply@smolstudio.com
```

We will configure the DNS records provided by Resend in GoDaddy.

We will verify:

```text
SPF
DKIM
DMARC
```

before production email is enabled.

---

# 28. Email Architecture

Email sending will not block the main ecommerce operation.

For example:

```text
Payment successful
      |
      v
Order created
      |
      +----> Customer sees success
      |
      +----> Resend sends email
```

If Resend temporarily has a problem, the successful order should still remain successful.

---

# 29. GitHub and Deployment

We will keep the complete project in GitHub.

Our deployment process will be:

```text
Local Development
       |
       v
GitHub
       |
       v
GitHub Actions
       |
       v
Tests
       |
       v
Build
       |
       v
AWS EC2
```

Before deployment we will run:

```text
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

We will deploy only after the production build succeeds.

---

# 30. Database Migration Process

All database changes will go through our migration system.

We will not randomly modify production tables manually.

Our production migration process will be:

```text
Backup RDS
     |
     v
Run migration
     |
     v
Verify migration
     |
     v
Deploy API
     |
     v
Health check
     |
     v
Application testing
```

---

# 31. Monitoring

We will use CloudWatch to monitor:

* EC2 CPU
* memory
* disk
* API logs
* Nginx logs
* RDS CPU
* RDS storage
* RDS connections
* application errors

We will create alerts for important conditions.

For example:

```text
EC2 CPU > 70%
EC2 disk > 80%
RDS CPU > 70%
RDS storage getting low
API health check failing
Large increase in 5xx errors
```

---

# 32. API Health Check

Our existing API health endpoint is:

```text
/health
```

Production will use:

```text
https://api.smolstudio.com/health
```

We will monitor this endpoint continuously.

Later we can add a readiness endpoint that checks both:

```text
API
+
Database
```

---

# 33. Production Security

Before launch we will verify:

* HTTPS
* Secure cookies
* HttpOnly cookies
* appropriate SameSite settings
* production CORS
* rate limiting
* security headers
* private RDS
* private S3
* restricted AWS access
* protected secrets
* database backups
* Razorpay secret protection
* Resend API key protection

We will never log:

* passwords
* session tokens
* reset tokens
* Razorpay secret keys
* AWS secrets
* database passwords

---

# 34. Checkout Security

The server will calculate:

```text
Product subtotal
Discount
Shipping
GST
Final amount
```

The browser will not be trusted to determine the final payable amount.

The Razorpay order amount will be based on the server-calculated amount.

The final payment verification will also happen on the server.

---

# 35. Shipping Configuration

Our production shipping rule will be:

```text
Order taxable amount <= ₹499
        |
        v
₹80 shipping

Order taxable amount >= ₹500
        |
        v
FREE shipping
```

Therefore our production environment will use:

```env
SHIPPING_FLAT_INR=80
FREE_SHIPPING_THRESHOLD_INR=500
```

We will keep these values configurable rather than hardcoding them.

---

# 36. GST

Our current development environment uses:

```env
GST_RATE_PERCENT=0
```

Before production launch we will confirm the appropriate GST treatment for our products and business.

The production value will be changed based on the applicable tax setup.

---

# 37. Coupon Testing

Before production we will test:

* first-time customer coupon
* normal coupon
* invalid coupon
* expired coupon
* minimum order requirement
* maximum redemption
* category-specific coupon
* percentage discount
* coupon removal
* checkout total
* Razorpay amount
* order total

All coupon calculations will remain server-side.

---

# 38. Orders and Payments

We will test:

```text
Successful payment
Failed payment
Cancelled payment
Duplicate payment callback
Payment verification
Order creation
Order status
Refund
Partial refund
Store credit
```

We will make sure a failed or incomplete payment cannot accidentally create a paid order.

---

# 39. Returns and Replacements

Our production testing will include the existing after-sales functionality:

```text
Product fault
Size replacement
Partial quantity return
Return fee
Refund
Store credit
Return images
Admin approval
```

We will specifically test:

```text
1 item return
2 item return
partial return
size replacement
rejected return
cancelled return
refund
return fee
```

---

# 40. Initial User Capacity

Our initial target is:

```text
Approximately 5,000 registered users
```

This does not mean 5,000 users will access the website simultaneously.

We will monitor actual:

* concurrent users
* requests per second
* API response time
* database connections
* CPU
* RAM
* database load

and scale based on real usage.

---

# 41. Initial Application Capacity

We will start with:

```text
1 × EC2 application server
1 × RDS SQL Server
1 × S3 bucket
CloudFront
CloudWatch
```

If traffic increases, we can scale without redesigning the whole application.

---

# 42. When We Need a Larger EC2 Server

If our application server consistently reaches:

```text
CPU > 70%
RAM > 75–80%
```

we will increase the EC2 instance size.

For example:

```text
t3.medium
     ↓
t3.large
```

We will first measure the problem before adding additional infrastructure.

---

# 43. When We Need Multiple Servers

If one application server is no longer sufficient, we will move to:

```text
              Load Balancer
                    |
          +---------+---------+
          |                   |
          v                   v
       EC2 #1              EC2 #2
          |                   |
          +---------+---------+
                    |
                    v
                   RDS
```

At that point we will introduce:

* Application Load Balancer
* multiple EC2 instances
* auto scaling where appropriate

We will not pay for this architecture until our traffic requires it.

---

# 44. When We Need Redis

Redis will not be part of our first deployment.

We will introduce Redis later only if we need:

* caching
* distributed rate limiting
* temporary data
* session infrastructure
* frequently accessed catalogue data

---

# 45. When We Need a Queue

If email, image processing or other background tasks begin affecting API performance, we will introduce a queue.

The future architecture can be:

```text
API
 |
 v
AWS SQS
 |
 v
Worker
 |
 +----> Resend
 +----> Image processing
 +----> Other background tasks
```

---

# 46. Future Scaling Architecture

When SmolStudio grows significantly, we can move toward:

```text
                    CloudFront
                        |
                 +------+------+
                 |             |
                 v             v
              Website        API
                               |
                        Load Balancer
                               |
                     +---------+---------+
                     |                   |
                     v                   v
                   API #1              API #2
                     |                   |
                     +---------+---------+
                               |
                               v
                              RDS
                               |
                +--------------+--------------+
                |              |              |
                v              v              v
               S3           Redis           SQS
```

This will be a later stage.

---

# 47. Estimated Monthly Budget

Our initial planning budget will be approximately:

| Service                    |                 Estimated cost |
| -------------------------- | -----------------------------: |
| EC2                        |            ₹3,000–₹4,500/month |
| RDS SQL Server             | ₹1,500–₹4,000/month initially* |
| S3                         |                ₹100–₹500/month |
| CloudFront                 |                ₹0–₹1,500/month |
| CloudWatch                 |                ₹0–₹1,000/month |
| GoDaddy                    |     ~₹80–₹210/month equivalent |
| Resend                     |                   ₹0 initially |
| Razorpay                   |              Transaction based |
| **Initial planning range** |      **~₹8,000–₹15,000/month** |

`*` The RDS cost can increase significantly if we need a paid SQL Server edition.

The actual AWS cost will depend on:

* instance sizes
* database edition
* storage
* traffic
* data transfer
* image traffic
* logs
* backups

We will use the AWS Pricing Calculator before finalizing the exact production resources.

---

# 48. Razorpay and Resend Are Variable Costs

Our fixed infrastructure and transaction costs are different.

### AWS

Capacity based:

```text
EC2
RDS
S3
CloudFront
CloudWatch
```

### Razorpay

Sales/payment based:

```text
More sales
    ↓
More payment processing fees
```

### Resend

Email volume based:

```text
More emails
    ↓
Higher email plan if required
```

Therefore we will not calculate the entire production cost simply from the number of registered users.

---

# 49. First Production Budget

For the initial launch we will keep approximately:

```text
AWS:
₹6,000 – ₹12,000/month

GoDaddy:
₹1,000 – ₹2,500/year

Resend:
₹0 initially

Razorpay:
approximately 2% standard platform fee
+ applicable GST/charges
```

We will keep an additional buffer for unexpected AWS usage.

A practical starting infrastructure budget will therefore be:

```text
₹8,000 – ₹15,000/month
```

excluding Razorpay transaction charges and applicable taxes.

---

# 50. Deployment Phases

## Phase 1 - Domain and AWS

We will:

* purchase the GoDaddy domain
* create AWS account
* enable MFA
* configure billing alerts
* select Mumbai region
* create VPC
* create security groups

---

## Phase 2 - Database

We will:

* create RDS SQL Server
* configure private access
* configure backups
* configure encryption
* create production database
* run all migrations
* verify schema

---

## Phase 3 - Application Server

We will:

* create EC2
* install Docker
* install Docker Compose
* configure Nginx
* configure firewall
* deploy Next.js
* deploy Fastify API
* configure production environment variables

---

## Phase 4 - Domain and HTTPS

We will:

* configure GoDaddy DNS
* connect domain to AWS
* configure `api.smolstudio.com`
* enable HTTPS
* redirect HTTP to HTTPS
* verify both website and API

---

## Phase 5 - S3 and CloudFront

We will:

* create production S3 bucket
* configure private access
* configure IAM
* upload test images
* configure CloudFront
* verify product image delivery

---

## Phase 6 - Resend

We will:

* create Resend production account
* verify `smolstudio.com`
* configure DNS
* configure SPF
* configure DKIM
* configure DMARC
* send test emails
* connect the API to production Resend

---

## Phase 7 - Razorpay

We will:

* activate production Razorpay
* complete required verification
* configure live keys
* configure webhooks
* test payments
* test failed payments
* test refunds
* verify payment signatures

---

## Phase 8 - Testing

We will test the complete customer journey:

```text
Register
   ↓
Login
   ↓
Browse
   ↓
Wishlist
   ↓
Add to Cart
   ↓
Checkout
   ↓
Coupon
   ↓
Address
   ↓
Razorpay
   ↓
Payment
   ↓
Order
   ↓
Email
   ↓
Shipping
   ↓
Tracking
   ↓
Return
   ↓
Refund / Store Credit
```

---

# 51. Soft Launch

We will not immediately open the application to everyone.

We will first:

```text
Internal testing
      ↓
Small group testing
      ↓
Soft launch
      ↓
Monitor
      ↓
Fix issues
      ↓
Wider launch
```

During the soft launch we will monitor:

* checkout errors
* payment failures
* API errors
* database performance
* email delivery
* AWS costs
* image delivery
* customer login
* order creation

---

# 52. 30-Day Deployment Schedule

## Week 1

```text
GoDaddy
AWS account
VPC
IAM
Security Groups
RDS
EC2
```

## Week 2

```text
Docker production setup
Nginx
HTTPS
Domain
S3
CloudFront
Production environment
```

## Week 3

```text
Razorpay
Resend
Database migrations
Payment testing
Email testing
Checkout testing
Return/refund testing
```

## Week 4

```text
Full production testing
Soft launch
Monitoring
Bug fixing
Performance tuning
Wider launch
```

---

# 53. Final Production Setup

Our first production deployment will therefore be:

```text
                    GoDaddy
                       |
                       v
                 smolstudio.com
                       |
                       v
                     AWS
                       |
              +--------+--------+
              |                 |
              v                 v
           EC2              CloudFront
              |                 |
        +-----+-----+           v
        |           |           S3
        v           v
     Next.js      Fastify
                    |
                    v
                   RDS
               SQL Server

Fastify
   |
   +----> Razorpay
   |
   +----> Resend
```

---

# 54. Final Initial Infrastructure

We will start with:

```text
GoDaddy
    → Domain

AWS EC2
    → Next.js
    → Fastify
    → Nginx

AWS RDS
    → SQL Server

AWS S3
    → Product images

AWS CloudFront
    → Image delivery

AWS CloudWatch
    → Monitoring

Razorpay
    → Payments

Resend
    → Transactional emails

GitHub
    → Source code and CI/CD
```

We will keep the first deployment simple and cost-controlled for approximately 5,000 users.

As actual traffic grows, we will increase EC2 capacity first, then introduce multiple application servers/load balancing, caching, queues and additional database capacity only when required by real application metrics.
