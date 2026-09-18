USE smolstudio;
GO

/* =========================================================
   PRODUCT-LEVEL RETURNS / REPLACEMENTS
   + STORE CREDIT
   ========================================================= */


/* =========================================================
   1. Extend return_requests
   ========================================================= */

IF COL_LENGTH('dbo.return_requests', 'order_item_id') IS NULL
BEGIN
    ALTER TABLE dbo.return_requests
    ADD order_item_id UNIQUEIDENTIFIER NULL;
END;
GO


IF COL_LENGTH('dbo.return_requests', 'request_type') IS NULL
BEGIN
    ALTER TABLE dbo.return_requests
    ADD request_type NVARCHAR(40) NULL;
END;
GO


IF COL_LENGTH('dbo.return_requests', 'requested_size') IS NULL
BEGIN
    ALTER TABLE dbo.return_requests
    ADD requested_size NVARCHAR(40) NULL;
END;
GO


IF COL_LENGTH('dbo.return_requests', 'approved_credit_inr') IS NULL
BEGIN
    ALTER TABLE dbo.return_requests
    ADD approved_credit_inr DECIMAL(12,2) NULL;
END;
GO


IF COL_LENGTH('dbo.return_requests', 'replacement_variant_id') IS NULL
BEGIN
    ALTER TABLE dbo.return_requests
    ADD replacement_variant_id UNIQUEIDENTIFIER NULL;
END;
GO


IF COL_LENGTH('dbo.return_requests', 'admin_reviewed_at') IS NULL
BEGIN
    ALTER TABLE dbo.return_requests
    ADD admin_reviewed_at DATETIME2(3) NULL;
END;
GO


IF COL_LENGTH('dbo.return_requests', 'admin_reviewed_by') IS NULL
BEGIN
    ALTER TABLE dbo.return_requests
    ADD admin_reviewed_by UNIQUEIDENTIFIER NULL;
END;
GO


IF COL_LENGTH('dbo.return_requests', 'replacement_order_id') IS NULL
BEGIN
    ALTER TABLE dbo.return_requests
    ADD replacement_order_id UNIQUEIDENTIFIER NULL;
END;
GO


IF COL_LENGTH('dbo.return_requests', 'replacement_fulfilled_at') IS NULL
BEGIN
    ALTER TABLE dbo.return_requests
    ADD replacement_fulfilled_at DATETIME2(3) NULL;
END;
GO


/* =========================================================
   2. Foreign keys for return_requests
   ========================================================= */

IF NOT EXISTS
(
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_return_requests_order_item'
      AND parent_object_id = OBJECT_ID('dbo.return_requests')
)
BEGIN
    ALTER TABLE dbo.return_requests
    ADD CONSTRAINT FK_return_requests_order_item
        FOREIGN KEY (order_item_id)
        REFERENCES dbo.order_items(id);
END;
GO


IF NOT EXISTS
(
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_return_requests_replacement_variant'
      AND parent_object_id = OBJECT_ID('dbo.return_requests')
)
BEGIN
    ALTER TABLE dbo.return_requests
    ADD CONSTRAINT FK_return_requests_replacement_variant
        FOREIGN KEY (replacement_variant_id)
        REFERENCES dbo.product_variants(id);
END;
GO


IF NOT EXISTS
(
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_return_requests_admin'
      AND parent_object_id = OBJECT_ID('dbo.return_requests')
)
BEGIN
    ALTER TABLE dbo.return_requests
    ADD CONSTRAINT FK_return_requests_admin
        FOREIGN KEY (admin_reviewed_by)
        REFERENCES dbo.customers(id);
END;
GO


IF NOT EXISTS
(
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_return_requests_replacement_order'
      AND parent_object_id = OBJECT_ID('dbo.return_requests')
)
BEGIN
    ALTER TABLE dbo.return_requests
    ADD CONSTRAINT FK_return_requests_replacement_order
        FOREIGN KEY (replacement_order_id)
        REFERENCES dbo.orders(id);
END;
GO


/* =========================================================
   3. Indexes for return requests
   ========================================================= */

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_return_requests_order_item'
      AND object_id = OBJECT_ID('dbo.return_requests')
)
BEGIN
    CREATE INDEX IX_return_requests_order_item
        ON dbo.return_requests(order_item_id, created_at DESC);
END;
GO


IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_return_requests_status'
      AND object_id = OBJECT_ID('dbo.return_requests')
)
BEGIN
    CREATE INDEX IX_return_requests_status
        ON dbo.return_requests(status, created_at DESC);
END;
GO


/* =========================================================
   4. Store credit accounts
   One account per customer
   ========================================================= */

IF OBJECT_ID('dbo.store_credit_accounts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.store_credit_accounts
    (
        id UNIQUEIDENTIFIER NOT NULL
            PRIMARY KEY,

        customer_id UNIQUEIDENTIFIER NOT NULL,

        balance_inr DECIMAL(12,2) NOT NULL
            CONSTRAINT DF_store_credit_accounts_balance
            DEFAULT 0,

        created_at DATETIME2(3) NOT NULL
            CONSTRAINT DF_store_credit_accounts_created
            DEFAULT SYSUTCDATETIME(),

        updated_at DATETIME2(3) NOT NULL
            CONSTRAINT DF_store_credit_accounts_updated
            DEFAULT SYSUTCDATETIME(),

        CONSTRAINT UQ_store_credit_accounts_customer
            UNIQUE (customer_id),

        CONSTRAINT FK_store_credit_accounts_customer
            FOREIGN KEY (customer_id)
            REFERENCES dbo.customers(id),

        CONSTRAINT CK_store_credit_accounts_balance
            CHECK (balance_inr >= 0)
    );
END;
GO


/* =========================================================
   5. Store credit transaction ledger
   ========================================================= */

IF OBJECT_ID('dbo.store_credit_transactions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.store_credit_transactions
    (
        id UNIQUEIDENTIFIER NOT NULL
            PRIMARY KEY,

        account_id UNIQUEIDENTIFIER NOT NULL,

        transaction_type NVARCHAR(30) NOT NULL,

        amount_inr DECIMAL(12,2) NOT NULL,

        balance_after_inr DECIMAL(12,2) NOT NULL,

        return_request_id UNIQUEIDENTIFIER NULL,

        order_id UNIQUEIDENTIFIER NULL,

        description NVARCHAR(500) NULL,

        created_at DATETIME2(3) NOT NULL
            CONSTRAINT DF_store_credit_transactions_created
            DEFAULT SYSUTCDATETIME(),

        CONSTRAINT FK_store_credit_transactions_account
            FOREIGN KEY (account_id)
            REFERENCES dbo.store_credit_accounts(id),

        CONSTRAINT FK_store_credit_transactions_return
            FOREIGN KEY (return_request_id)
            REFERENCES dbo.return_requests(id),

        CONSTRAINT FK_store_credit_transactions_order
            FOREIGN KEY (order_id)
            REFERENCES dbo.orders(id),

        CONSTRAINT CK_store_credit_transactions_amount
            CHECK (amount_inr <> 0),

        CONSTRAINT CK_store_credit_transactions_balance
            CHECK (balance_after_inr >= 0)
    );
END;
GO


/* =========================================================
   6. Store credit indexes
   ========================================================= */

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_store_credit_transactions_account_created'
      AND object_id = OBJECT_ID('dbo.store_credit_transactions')
)
BEGIN
    CREATE INDEX IX_store_credit_transactions_account_created
        ON dbo.store_credit_transactions(account_id, created_at DESC);
END;
GO


IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_store_credit_transactions_return'
      AND object_id = OBJECT_ID('dbo.store_credit_transactions')
)
BEGIN
    CREATE INDEX IX_store_credit_transactions_return
        ON dbo.store_credit_transactions(return_request_id);
END;
GO


IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_store_credit_transactions_order'
      AND object_id = OBJECT_ID('dbo.store_credit_transactions')
)
BEGIN
    CREATE INDEX IX_store_credit_transactions_order
        ON dbo.store_credit_transactions(order_id);
END;
GO


/* =========================================================
   7. Useful validation constraints
   ========================================================= */

IF NOT EXISTS
(
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_return_requests_approved_credit'
)
BEGIN
    ALTER TABLE dbo.return_requests
    ADD CONSTRAINT CK_return_requests_approved_credit
        CHECK (
            approved_credit_inr IS NULL
            OR approved_credit_inr >= 0
        );
END;
GO


/* =========================================================
   8. Verify migration
   ========================================================= */

SELECT
    c.name AS column_name,
    t.name AS data_type,
    c.max_length,
    c.is_nullable
FROM sys.columns c
INNER JOIN sys.types t
    ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.return_requests')
ORDER BY c.column_id;
GO


SELECT
    name,
    type_desc
FROM sys.tables
WHERE name IN
(
    'return_requests',
    'store_credit_accounts',
    'store_credit_transactions'
)
ORDER BY name;
GO
