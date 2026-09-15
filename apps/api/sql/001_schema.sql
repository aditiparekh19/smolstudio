IF DB_ID(N'smolstudio') IS NULL
BEGIN
  CREATE DATABASE smolstudio;
END
GO

USE smolstudio
GO

IF OBJECT_ID('dbo.customers', 'U') IS NULL
CREATE TABLE customers (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  email NVARCHAR(320) NOT NULL UNIQUE,
  phone NVARCHAR(32) NULL,
  first_name NVARCHAR(100) NULL,
  last_name NVARCHAR(100) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.addresses', 'U') IS NULL
CREATE TABLE addresses (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  customer_id UNIQUEIDENTIFIER NOT NULL,
  label NVARCHAR(50) NULL,
  recipient_name NVARCHAR(200) NOT NULL,
  line1 NVARCHAR(250) NOT NULL,
  line2 NVARCHAR(250) NULL,
  city NVARCHAR(120) NOT NULL,
  state NVARCHAR(120) NOT NULL,
  postal_code NVARCHAR(20) NOT NULL,
  country_code CHAR(2) NOT NULL DEFAULT 'IN',
  phone NVARCHAR(32) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_addresses_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);
GO

IF OBJECT_ID('dbo.categories', 'U') IS NULL
CREATE TABLE categories (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  slug NVARCHAR(120) NOT NULL UNIQUE,
  name NVARCHAR(150) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.products', 'U') IS NULL
CREATE TABLE products (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  category_id UNIQUEIDENTIFIER NOT NULL,
  slug NVARCHAR(180) NOT NULL UNIQUE,
  sku NVARCHAR(80) NOT NULL UNIQUE,
  name NVARCHAR(220) NOT NULL,
  description NVARCHAR(MAX) NULL,
  price_inr DECIMAL(12,2) NOT NULL,
  compare_at_price_inr DECIMAL(12,2) NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_products_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT CK_products_price CHECK (price_inr >= 0)
);
GO

IF OBJECT_ID('dbo.product_variants', 'U') IS NULL
CREATE TABLE product_variants (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  product_id UNIQUEIDENTIFIER NOT NULL,
  sku NVARCHAR(100) NOT NULL UNIQUE,
  size NVARCHAR(40) NOT NULL,
  color NVARCHAR(80) NOT NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_variants_product FOREIGN KEY (product_id) REFERENCES products(id)
);
GO

IF OBJECT_ID('dbo.product_images', 'U') IS NULL
CREATE TABLE product_images (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  product_id UNIQUEIDENTIFIER NOT NULL,
  url NVARCHAR(2048) NOT NULL,
  alt_text NVARCHAR(300) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_images_product FOREIGN KEY (product_id) REFERENCES products(id)
);
GO

IF OBJECT_ID('dbo.inventory', 'U') IS NULL
CREATE TABLE inventory (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  variant_id UNIQUEIDENTIFIER NOT NULL UNIQUE,
  quantity_available INT NOT NULL DEFAULT 0,
  quantity_reserved INT NOT NULL DEFAULT 0,
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_inventory_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  CONSTRAINT CK_inventory_available CHECK (quantity_available >= 0),
  CONSTRAINT CK_inventory_reserved CHECK (quantity_reserved >= 0)
);
GO

IF OBJECT_ID('dbo.carts', 'U') IS NULL
CREATE TABLE carts (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  customer_id UNIQUEIDENTIFIER NULL,
  anonymous_token NVARCHAR(120) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_carts_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_carts_anonymous_token'
      AND object_id = OBJECT_ID('dbo.carts')
)
BEGIN
    CREATE UNIQUE INDEX UX_carts_anonymous_token
    ON dbo.carts(anonymous_token)
    WHERE anonymous_token IS NOT NULL;
END
GO

IF OBJECT_ID('dbo.cart_items', 'U') IS NULL
CREATE TABLE cart_items (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  cart_id UNIQUEIDENTIFIER NOT NULL,
  variant_id UNIQUEIDENTIFIER NOT NULL,
  quantity INT NOT NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_cart_variant UNIQUE (cart_id, variant_id),
  CONSTRAINT FK_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id),
  CONSTRAINT FK_cart_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  CONSTRAINT CK_cart_items_quantity CHECK (quantity > 0)
);
GO

IF OBJECT_ID('dbo.orders', 'U') IS NULL
CREATE TABLE orders (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  order_number NVARCHAR(40) NOT NULL UNIQUE,
  customer_id UNIQUEIDENTIFIER NULL,
  status NVARCHAR(30) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  subtotal_inr DECIMAL(12,2) NOT NULL,
  shipping_inr DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_inr DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_inr DECIMAL(12,2) NOT NULL,
  shipping_address_json NVARCHAR(MAX) NOT NULL,
  payment_provider NVARCHAR(40) NULL,
  payment_reference NVARCHAR(120) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);
GO

IF OBJECT_ID('dbo.order_items', 'U') IS NULL
CREATE TABLE order_items (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  order_id UNIQUEIDENTIFIER NOT NULL,
  variant_id UNIQUEIDENTIFIER NULL,
  product_name NVARCHAR(220) NOT NULL,
  sku NVARCHAR(100) NOT NULL,
  quantity INT NOT NULL,
  unit_price_inr DECIMAL(12,2) NOT NULL,
  total_price_inr DECIMAL(12,2) NOT NULL,
  CONSTRAINT FK_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT FK_order_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id)
);
GO

IF OBJECT_ID('dbo.wishlists', 'U') IS NULL
CREATE TABLE wishlists (
  customer_id UNIQUEIDENTIFIER NOT NULL,
  product_id UNIQUEIDENTIFIER NOT NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  PRIMARY KEY (customer_id, product_id),
  CONSTRAINT FK_wishlists_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT FK_wishlists_product FOREIGN KEY (product_id) REFERENCES products(id)
);
GO

IF OBJECT_ID('dbo.product_reviews', 'U') IS NULL
CREATE TABLE product_reviews (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  product_id UNIQUEIDENTIFIER NOT NULL,
  customer_id UNIQUEIDENTIFIER NOT NULL,
  rating TINYINT NOT NULL,
  title NVARCHAR(160) NULL,
  body NVARCHAR(2000) NULL,
  is_published BIT NOT NULL DEFAULT 0,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_reviews_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT FK_reviews_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT CK_reviews_rating CHECK (rating BETWEEN 1 AND 5)
);
GO

IF OBJECT_ID('dbo.coupons', 'U') IS NULL
CREATE TABLE coupons (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  code NVARCHAR(50) NOT NULL UNIQUE,
  discount_type NVARCHAR(20) NOT NULL,
  discount_value DECIMAL(12,2) NOT NULL,
  max_redemptions INT NULL,
  redeemed_count INT NOT NULL DEFAULT 0,
  starts_at DATETIME2(3) NOT NULL,
  ends_at DATETIME2(3) NULL,
  is_active BIT NOT NULL DEFAULT 1
);
GO

IF OBJECT_ID('dbo.audit_events', 'U') IS NULL
CREATE TABLE audit_events (
  id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  actor_customer_id UNIQUEIDENTIFIER NULL,
  event_type NVARCHAR(100) NOT NULL,
  entity_type NVARCHAR(80) NOT NULL,
  entity_id UNIQUEIDENTIFIER NULL,
  payload_json NVARCHAR(MAX) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_products_category_active_created' AND object_id = OBJECT_ID('dbo.products'))
  CREATE INDEX IX_products_category_active_created ON products(category_id, is_active, created_at DESC) INCLUDE (name, slug, price_inr, compare_at_price_inr);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_product_images_product_sort' AND object_id = OBJECT_ID('dbo.product_images'))
  CREATE INDEX IX_product_images_product_sort ON product_images(product_id, sort_order);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_variants_product' AND object_id = OBJECT_ID('dbo.product_variants'))
  CREATE INDEX IX_variants_product ON product_variants(product_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_inventory_variant' AND object_id = OBJECT_ID('dbo.inventory'))
  CREATE INDEX IX_inventory_variant ON inventory(variant_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_orders_customer_created' AND object_id = OBJECT_ID('dbo.orders'))
  CREATE INDEX IX_orders_customer_created ON orders(customer_id, created_at DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_reviews_product_published' AND object_id = OBJECT_ID('dbo.product_reviews'))
  CREATE INDEX IX_reviews_product_published ON product_reviews(product_id, is_published, created_at DESC);
GO
