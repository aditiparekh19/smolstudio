USE smolstudio;
GO

/* =========================================================
   PRODUCT FAULT EVIDENCE IMAGES
   Maximum of 3 images is enforced by the API.
   ========================================================= */

IF OBJECT_ID('dbo.return_request_images', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.return_request_images
    (
        id UNIQUEIDENTIFIER NOT NULL
            PRIMARY KEY,

        return_request_id UNIQUEIDENTIFIER NOT NULL,

        filename NVARCHAR(255) NOT NULL,

        content_type NVARCHAR(100) NOT NULL,

        storage_path NVARCHAR(1000) NOT NULL,

        created_at DATETIME2(3) NOT NULL
            CONSTRAINT DF_return_request_images_created
            DEFAULT SYSUTCDATETIME(),

        CONSTRAINT FK_return_request_images_request
            FOREIGN KEY (return_request_id)
            REFERENCES dbo.return_requests(id)
            ON DELETE CASCADE
    );
END;
GO


/* =========================================================
   INDEX
   ========================================================= */

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_return_request_images_request'
      AND object_id = OBJECT_ID('dbo.return_request_images')
)
BEGIN
    CREATE INDEX IX_return_request_images_request
        ON dbo.return_request_images(
            return_request_id,
            created_at
        );
END;
GO


/* =========================================================
   VERIFY
   ========================================================= */

SELECT
    c.name AS column_name,
    t.name AS data_type,
    c.max_length,
    c.is_nullable
FROM sys.columns c
INNER JOIN sys.types t
    ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.return_request_images')
ORDER BY c.column_id;
GO


SELECT
    name,
    type_desc
FROM sys.tables
WHERE name IN
(
    'return_requests',
    'return_request_images',
    'store_credit_accounts',
    'store_credit_transactions'
)
ORDER BY name;
GO
