USE smolstudio;
GO

IF COL_LENGTH('dbo.return_requests', 'processing_at') IS NULL
    ALTER TABLE dbo.return_requests ADD processing_at datetime2 NULL;
GO

IF COL_LENGTH('dbo.return_requests', 'pickup_assigned_at') IS NULL
    ALTER TABLE dbo.return_requests ADD pickup_assigned_at datetime2 NULL;
GO

IF COL_LENGTH('dbo.return_requests', 'pickup_partner') IS NULL
    ALTER TABLE dbo.return_requests ADD pickup_partner nvarchar(200) NULL;
GO

IF COL_LENGTH('dbo.return_requests', 'picked_up_at') IS NULL
    ALTER TABLE dbo.return_requests ADD picked_up_at datetime2 NULL;
GO

IF COL_LENGTH('dbo.return_requests', 'received_at') IS NULL
    ALTER TABLE dbo.return_requests ADD received_at datetime2 NULL;
GO

IF COL_LENGTH('dbo.return_requests', 'reviewed_at') IS NULL
    ALTER TABLE dbo.return_requests ADD reviewed_at datetime2 NULL;
GO

IF COL_LENGTH('dbo.return_requests', 'completed_at') IS NULL
    ALTER TABLE dbo.return_requests ADD completed_at datetime2 NULL;
GO
