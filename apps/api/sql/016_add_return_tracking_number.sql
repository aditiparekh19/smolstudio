IF COL_LENGTH('dbo.return_requests', 'pickup_tracking_number') IS NULL
BEGIN
    ALTER TABLE dbo.return_requests
    ADD pickup_tracking_number nvarchar(100) NULL;
END;
