USE smolstudio;
GO

/* 
   Fix carts.anonymous_token

   Old schema may contain a UNIQUE constraint/index on anonymous_token
   that incorrectly allows only one NULL value.

   We want:
   - multiple NULL anonymous_token values
   - unique non-NULL anonymous_token values
*/

IF OBJECT_ID('dbo.carts', 'U') IS NOT NULL
BEGIN

    /* Drop UNIQUE constraints on anonymous_token */
    DECLARE @constraintName NVARCHAR(128);

    SELECT TOP 1
        @constraintName = kc.name
    FROM sys.key_constraints kc
    INNER JOIN sys.index_columns ic
        ON kc.parent_object_id = ic.object_id
        AND kc.unique_index_id = ic.index_id
    INNER JOIN sys.columns c
        ON ic.object_id = c.object_id
        AND ic.column_id = c.column_id
    WHERE kc.parent_object_id = OBJECT_ID('dbo.carts')
      AND kc.type = 'UQ'
      AND c.name = 'anonymous_token';

    IF @constraintName IS NOT NULL
    BEGIN
        DECLARE @sql NVARCHAR(MAX);

        SET @sql =
            N'ALTER TABLE dbo.carts DROP CONSTRAINT '
            + QUOTENAME(@constraintName);

        EXEC sp_executesql @sql;
    END;


    /* Drop any remaining standalone unique index on anonymous_token */
    DECLARE @indexName NVARCHAR(128);

    SELECT TOP 1
        @indexName = i.name
    FROM sys.indexes i
    INNER JOIN sys.index_columns ic
        ON i.object_id = ic.object_id
        AND i.index_id = ic.index_id
    INNER JOIN sys.columns c
        ON ic.object_id = c.object_id
        AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('dbo.carts')
      AND i.is_unique = 1
      AND i.name <> 'UX_carts_anonymous_token'
      AND c.name = 'anonymous_token';

    IF @indexName IS NOT NULL
    BEGIN
        DECLARE @dropSql NVARCHAR(MAX);

        SET @dropSql =
            N'DROP INDEX '
            + QUOTENAME(@indexName)
            + N' ON dbo.carts';

        EXEC sp_executesql @dropSql;
    END;


    /* Create the correct filtered unique index */
    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'UX_carts_anonymous_token'
          AND object_id = OBJECT_ID('dbo.carts')
    )
    BEGIN
        CREATE UNIQUE INDEX UX_carts_anonymous_token
        ON dbo.carts(anonymous_token)
        WHERE anonymous_token IS NOT NULL;
    END;

END;
GO
