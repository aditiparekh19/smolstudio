USE smolstudio;
GO

CREATE UNIQUE INDEX UX_product_reviews_product_customer
ON dbo.product_reviews(product_id, customer_id);
GO
