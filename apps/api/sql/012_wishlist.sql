USE smolstudio;
GO

IF OBJECT_ID('dbo.wishlist_items', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.wishlist_items
    (
        id UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_wishlist_items PRIMARY KEY,

        customer_id UNIQUEIDENTIFIER NOT NULL,

        product_id UNIQUEIDENTIFIER NOT NULL,

        created_at DATETIME2(3) NOT NULL
            CONSTRAINT DF_wishlist_items_created_at
            DEFAULT SYSUTCDATETIME(),

        CONSTRAINT FK_wishlist_items_customer
            FOREIGN KEY (customer_id)
            REFERENCES dbo.customers(id)
            ON DELETE CASCADE,

        CONSTRAINT FK_wishlist_items_product
            FOREIGN KEY (product_id)
            REFERENCES dbo.products(id)
            ON DELETE CASCADE,

        CONSTRAINT UQ_wishlist_items_customer_product
            UNIQUE (customer_id, product_id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_wishlist_items_customer'
      AND object_id = OBJECT_ID('dbo.wishlist_items')
)
BEGIN
    CREATE INDEX IX_wishlist_items_customer
        ON dbo.wishlist_items(customer_id, created_at DESC);
END
GO
