USE smolstudio
GO

IF COL_LENGTH('dbo.orders', 'tax_inr') IS NULL
  ALTER TABLE orders ADD tax_inr DECIMAL(12,2) NOT NULL CONSTRAINT DF_orders_tax_inr DEFAULT 0;
GO
IF COL_LENGTH('dbo.orders', 'coupon_code') IS NULL
  ALTER TABLE orders ADD coupon_code NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.orders', 'payment_failed_at') IS NULL
  ALTER TABLE orders ADD payment_failed_at DATETIME2(3) NULL;
GO
IF COL_LENGTH('dbo.orders', 'cancelled_at') IS NULL
  ALTER TABLE orders ADD cancelled_at DATETIME2(3) NULL;
GO
IF COL_LENGTH('dbo.orders', 'cancel_reason') IS NULL
  ALTER TABLE orders ADD cancel_reason NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.coupons', 'min_order_inr') IS NULL
  ALTER TABLE coupons ADD min_order_inr DECIMAL(12,2) NOT NULL CONSTRAINT DF_coupons_min_order DEFAULT 0;
GO
IF COL_LENGTH('dbo.coupons', 'max_discount_inr') IS NULL
  ALTER TABLE coupons ADD max_discount_inr DECIMAL(12,2) NULL;
GO
IF OBJECT_ID('dbo.coupon_redemptions', 'U') IS NULL
CREATE TABLE coupon_redemptions (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  coupon_id UNIQUEIDENTIFIER NOT NULL,
  customer_id UNIQUEIDENTIFIER NOT NULL,
  order_id UNIQUEIDENTIFIER NOT NULL UNIQUE,
  discount_inr DECIMAL(12,2) NOT NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_coupon_redemptions_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  CONSTRAINT FK_coupon_redemptions_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT FK_coupon_redemptions_order FOREIGN KEY (order_id) REFERENCES orders(id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_coupon_redemptions_customer_coupon' AND object_id=OBJECT_ID('dbo.coupon_redemptions'))
  CREATE UNIQUE INDEX IX_coupon_redemptions_customer_coupon ON coupon_redemptions(customer_id,coupon_id);
GO

IF OBJECT_ID('dbo.inventory_reservations', 'U') IS NULL
CREATE TABLE inventory_reservations (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  order_id UNIQUEIDENTIFIER NOT NULL,
  variant_id UNIQUEIDENTIFIER NOT NULL,
  quantity INT NOT NULL,
  expires_at DATETIME2(3) NOT NULL,
  released_at DATETIME2(3) NULL,
  consumed_at DATETIME2(3) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_inventory_reservations_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT FK_inventory_reservations_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id),
  CONSTRAINT CK_inventory_reservations_quantity CHECK (quantity > 0)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_inventory_reservations_expiry' AND object_id=OBJECT_ID('dbo.inventory_reservations'))
  CREATE INDEX IX_inventory_reservations_expiry ON inventory_reservations(expires_at,released_at,consumed_at);
GO

IF OBJECT_ID('dbo.payment_webhook_events', 'U') IS NULL
CREATE TABLE payment_webhook_events (
  id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  event_id NVARCHAR(160) NOT NULL UNIQUE,
  event_type NVARCHAR(100) NOT NULL,
  payload_json NVARCHAR(MAX) NOT NULL,
  processed_at DATETIME2(3) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.payment_refunds', 'U') IS NULL
CREATE TABLE payment_refunds (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  order_id UNIQUEIDENTIFIER NOT NULL,
  payment_reference NVARCHAR(120) NOT NULL,
  razorpay_refund_id NVARCHAR(120) NULL UNIQUE,
  amount_inr DECIMAL(12,2) NOT NULL,
  status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
  reason NVARCHAR(500) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  processed_at DATETIME2(3) NULL,
  CONSTRAINT FK_payment_refunds_order FOREIGN KEY (order_id) REFERENCES orders(id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_payment_refunds_order' AND object_id=OBJECT_ID('dbo.payment_refunds'))
  CREATE INDEX IX_payment_refunds_order ON payment_refunds(order_id,created_at DESC);
GO

IF OBJECT_ID('dbo.order_status_history', 'U') IS NULL
CREATE TABLE order_status_history (
  id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  order_id UNIQUEIDENTIFIER NOT NULL,
  status NVARCHAR(30) NOT NULL,
  note NVARCHAR(500) NULL,
  actor_customer_id UNIQUEIDENTIFIER NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_order_status_history_order FOREIGN KEY (order_id) REFERENCES orders(id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_order_status_history_order' AND object_id=OBJECT_ID('dbo.order_status_history'))
  CREATE INDEX IX_order_status_history_order ON order_status_history(order_id,created_at ASC);
GO

IF OBJECT_ID('dbo.return_requests', 'U') IS NULL
CREATE TABLE return_requests (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  order_id UNIQUEIDENTIFIER NOT NULL,
  customer_id UNIQUEIDENTIFIER NOT NULL,
  reason NVARCHAR(1000) NOT NULL,
  status NVARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
  refund_amount_inr DECIMAL(12,2) NULL,
  admin_note NVARCHAR(1000) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_return_requests_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT FK_return_requests_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_return_requests_customer' AND object_id=OBJECT_ID('dbo.return_requests'))
  CREATE INDEX IX_return_requests_customer ON return_requests(customer_id,created_at DESC);
GO

IF OBJECT_ID('dbo.notification_log', 'U') IS NULL
CREATE TABLE notification_log (
  id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
  customer_id UNIQUEIDENTIFIER NULL,
  order_id UNIQUEIDENTIFIER NULL,
  channel NVARCHAR(20) NOT NULL,
  template NVARCHAR(100) NOT NULL,
  recipient NVARCHAR(320) NOT NULL,
  status NVARCHAR(30) NOT NULL,
  error_message NVARCHAR(1000) NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_orders_coupon' AND object_id=OBJECT_ID('dbo.orders'))
  CREATE INDEX IX_orders_coupon ON orders(coupon_code);
GO
