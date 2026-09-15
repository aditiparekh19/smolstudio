IF COL_LENGTH('dbo.orders', 'payment_order_id') IS NULL
  ALTER TABLE orders ADD payment_order_id NVARCHAR(120) NULL;
GO
IF COL_LENGTH('dbo.orders', 'payment_status') IS NULL
  ALTER TABLE orders ADD payment_status NVARCHAR(30) NOT NULL CONSTRAINT DF_orders_payment_status DEFAULT 'PENDING';
GO
IF COL_LENGTH('dbo.orders', 'tracking_number') IS NULL
  ALTER TABLE orders ADD tracking_number NVARCHAR(120) NULL;
GO
IF COL_LENGTH('dbo.orders', 'carrier') IS NULL
  ALTER TABLE orders ADD carrier NVARCHAR(120) NULL;
GO
IF COL_LENGTH('dbo.orders', 'tracking_url') IS NULL
  ALTER TABLE orders ADD tracking_url NVARCHAR(1000) NULL;
GO
IF COL_LENGTH('dbo.orders', 'shipped_at') IS NULL
  ALTER TABLE orders ADD shipped_at DATETIME2(3) NULL;
GO
IF COL_LENGTH('dbo.orders', 'delivered_at') IS NULL
  ALTER TABLE orders ADD delivered_at DATETIME2(3) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_orders_status_created' AND object_id = OBJECT_ID('dbo.orders'))
  CREATE INDEX IX_orders_status_created ON orders(status, created_at DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_orders_payment_order_id' AND object_id = OBJECT_ID('dbo.orders'))
  CREATE UNIQUE INDEX IX_orders_payment_order_id ON orders(payment_order_id) WHERE payment_order_id IS NOT NULL;
GO
