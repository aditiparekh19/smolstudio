USE smolstudio;
GO

PRINT 'Adding refund status support...';
GO

/*
  orders.payment_status is VARCHAR/CHAR and currently has no CHECK
  constraint, so REFUND_PENDING and PARTIALLY_REFUNDED can be stored
  without altering the column.
*/

/*
  payment_refunds.status may have an existing CHECK constraint.
  Drop it if it exists so we can support:
    PENDING
    PROCESSED
    FAILED
*/
DECLARE @constraintName NVARCHAR(255);

SELECT TOP 1
  @constraintName = cc.name
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.payment_refunds')
  AND (
    cc.definition LIKE '%status%'
    OR cc.definition LIKE '%PROCESSED%'
  );

IF @constraintName IS NOT NULL
BEGIN
    DECLARE @sql NVARCHAR(MAX);

    SET @sql =
      N'ALTER TABLE dbo.payment_refunds DROP CONSTRAINT '
      + QUOTENAME(@constraintName);

    PRINT 'Dropping existing payment_refunds status constraint: '
      + @constraintName;

    EXEC sp_executesql @sql;
END
ELSE
BEGIN
    PRINT 'No payment_refunds status CHECK constraint found.';
END;
GO

/*
  Add a clean status constraint.
*/
IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.payment_refunds')
      AND name = 'CK_payment_refunds_status'
)
BEGIN
    ALTER TABLE dbo.payment_refunds
    ADD CONSTRAINT CK_payment_refunds_status
    CHECK (
      status IN (
        'PENDING',
        'PROCESSED',
        'FAILED'
      )
    );

    PRINT 'Added CK_payment_refunds_status.';
END
ELSE
BEGIN
    PRINT 'CK_payment_refunds_status already exists.';
END;
GO

/*
  Verify the resulting constraints.
*/
SELECT
    name,
    definition
FROM sys.check_constraints
WHERE parent_object_id IN (
    OBJECT_ID('dbo.orders'),
    OBJECT_ID('dbo.payment_refunds')
)
ORDER BY parent_object_id, name;
GO

PRINT 'Refund status setup completed.';
GO
