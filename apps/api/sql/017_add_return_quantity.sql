/*
  SmolStudio — Add partial return quantity support

  Adds the quantity being returned/replaced for each after-sales request.
  Existing rows default to 1 so this remains backward-compatible.
*/

IF COL_LENGTH('dbo.return_requests', 'return_quantity') IS NULL
BEGIN
    ALTER TABLE dbo.return_requests
    ADD return_quantity INT NOT NULL
        CONSTRAINT DF_return_requests_return_quantity DEFAULT 1;
END;
GO

SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo'
  AND TABLE_NAME = 'return_requests'
  AND COLUMN_NAME = 'return_quantity';
GO
