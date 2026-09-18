USE smolstudio;
GO

/* ============================================================
   STORE CREDIT CHECKOUT SUPPORT
   ============================================================ */

IF COL_LENGTH('dbo.orders', 'store_credit_applied_inr') IS NULL
BEGIN
    ALTER TABLE dbo.orders
    ADD store_credit_applied_inr DECIMAL(12,2) NOT NULL
        CONSTRAINT DF_orders_store_credit_applied_inr DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.orders', 'store_credit_released_at') IS NULL
BEGIN
    ALTER TABLE dbo.orders
    ADD store_credit_released_at DATETIME2(3) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_store_credit_transactions_order_id'
      AND object_id = OBJECT_ID('dbo.store_credit_transactions')
)
BEGIN
    CREATE INDEX IX_store_credit_transactions_order_id
    ON dbo.store_credit_transactions(order_id);
END
GO

PRINT 'Store credit checkout migration complete.';
GO
