USE smolstudio
GO

IF COL_LENGTH('dbo.product_images', 'storage_key') IS NULL
  ALTER TABLE product_images ADD storage_key NVARCHAR(500) NULL;
GO

IF COL_LENGTH('dbo.product_images', 'is_primary') IS NULL
  ALTER TABLE product_images ADD is_primary BIT NOT NULL CONSTRAINT DF_product_images_is_primary DEFAULT 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_product_images_product_primary' AND object_id = OBJECT_ID('dbo.product_images'))
  CREATE INDEX IX_product_images_product_primary ON product_images(product_id, is_primary DESC, sort_order ASC);
GO
