IF OBJECT_ID('dbo.password_reset_tokens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.password_reset_tokens (
        id UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_password_reset_tokens PRIMARY KEY,

        customer_id UNIQUEIDENTIFIER NOT NULL,

        token_hash VARCHAR(64) NOT NULL,

        expires_at DATETIME2 NOT NULL,

        used_at DATETIME2 NULL,

        created_at DATETIME2 NOT NULL
            CONSTRAINT DF_password_reset_tokens_created_at
            DEFAULT SYSUTCDATETIME(),

        CONSTRAINT FK_password_reset_tokens_customer
            FOREIGN KEY (customer_id)
            REFERENCES dbo.customers(id)
            ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX UX_password_reset_tokens_token_hash
        ON dbo.password_reset_tokens(token_hash);

    CREATE INDEX IX_password_reset_tokens_customer
        ON dbo.password_reset_tokens(customer_id);

    CREATE INDEX IX_password_reset_tokens_expires_at
        ON dbo.password_reset_tokens(expires_at);
END;
