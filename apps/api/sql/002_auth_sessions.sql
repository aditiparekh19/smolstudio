
IF COL_LENGTH('dbo.customers', 'password_hash') IS NULL
  ALTER TABLE customers ADD password_hash NVARCHAR(300) NULL;
GO

IF COL_LENGTH('dbo.customers', 'role') IS NULL
  ALTER TABLE customers ADD role NVARCHAR(20) NOT NULL CONSTRAINT DF_customers_role DEFAULT 'CUSTOMER';
GO

IF OBJECT_ID('dbo.customer_sessions', 'U') IS NULL
CREATE TABLE customer_sessions (
  id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
  customer_id UNIQUEIDENTIFIER NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME2(3) NOT NULL,
  created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  last_seen_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_customer_sessions_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_customer_sessions_customer_expiry' AND object_id = OBJECT_ID('dbo.customer_sessions'))
  CREATE INDEX IX_customer_sessions_customer_expiry ON customer_sessions(customer_id, expires_at);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_carts_customer' AND object_id = OBJECT_ID('dbo.carts'))
  CREATE INDEX IX_carts_customer ON carts(customer_id, updated_at DESC);
GO
