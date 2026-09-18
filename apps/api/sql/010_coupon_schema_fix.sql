USE smolstudio;
GO

IF COL_LENGTH('dbo.coupons', 'min_order_inr') IS NULL
BEGIN
    ALTER TABLE dbo.coupons
    ADD min_order_inr DECIMAL(12,2) NOT NULL
        CONSTRAINT DF_coupons_min_order_inr DEFAULT (0);
END
GO

IF COL_LENGTH('dbo.coupons', 'max_discount_inr') IS NULL
BEGIN
    ALTER TABLE dbo.coupons
    ADD max_discount_inr DECIMAL(12,2) NULL;
END
GO

IF OBJECT_ID('dbo.coupon_categories', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.coupon_categories
    (
        coupon_id UNIQUEIDENTIFIER NOT NULL,
        category_id UNIQUEIDENTIFIER NOT NULL,
        CONSTRAINT PK_coupon_categories PRIMARY KEY (coupon_id, category_id),
        CONSTRAINT FK_coupon_categories_coupon
            FOREIGN KEY (coupon_id) REFERENCES dbo.coupons(id) ON DELETE CASCADE,
        CONSTRAINT FK_coupon_categories_category
            FOREIGN KEY (category_id) REFERENCES dbo.categories(id) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name='IX_coupon_categories_category'
      AND object_id=OBJECT_ID('dbo.coupon_categories')
)
BEGIN
    CREATE INDEX IX_coupon_categories_category
    ON dbo.coupon_categories(category_id, coupon_id);
END
GO

IF OBJECT_ID('dbo.coupon_redemptions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.coupon_redemptions
    (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        coupon_id UNIQUEIDENTIFIER NOT NULL,
        customer_id UNIQUEIDENTIFIER NULL,
        order_id UNIQUEIDENTIFIER NOT NULL,
        discount_inr DECIMAL(12,2) NOT NULL DEFAULT (0),
        created_at DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_coupon_redemptions_coupon
            FOREIGN KEY (coupon_id) REFERENCES dbo.coupons(id),
        CONSTRAINT FK_coupon_redemptions_customer
            FOREIGN KEY (customer_id) REFERENCES dbo.customers(id),
        CONSTRAINT FK_coupon_redemptions_order
            FOREIGN KEY (order_id) REFERENCES dbo.orders(id)
    );
END
GO
