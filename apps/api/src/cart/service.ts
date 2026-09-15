import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { getDb } from '../db.js';

export type CartItem = {
  id: string;
  variantId: string;
  slug: string;
  name: string;
  size: string;
  color: string;
  priceInr: number;
  quantity: number;
  imageUrl: string | null;
  totalInr: number;
};

export type Cart = {
  id: string;
  items: CartItem[];
  subtotalInr: number;
  count: number;
};

async function findOrCreateCart(customerId?: string | null, anonymousToken?: string | null) {
  const pool = await getDb();
  if (customerId) {
    const result = await pool.request().input('customerId', customerId).query<{ id: string }>(`
      SELECT TOP 1 id FROM carts WHERE customer_id = @customerId ORDER BY updated_at DESC;
    `);
    if (result.recordset[0]) return result.recordset[0].id;
    const id = randomUUID();
    await pool.request().input('id', id).input('customerId', customerId).query(`
      INSERT INTO carts (id, customer_id) VALUES (@id, @customerId);
    `);
    return id;
  }

  if (!anonymousToken) return null;
  const existing = await pool.request().input('anonymousToken', anonymousToken).query<{ id: string }>(`
    SELECT TOP 1 id FROM carts WHERE anonymous_token = @anonymousToken;
  `);
  if (existing.recordset[0]) return existing.recordset[0].id;

  const id = randomUUID();
  await pool.request().input('id', id).input('anonymousToken', anonymousToken).query(`
    INSERT INTO carts (id, anonymous_token) VALUES (@id, @anonymousToken);
  `);
  return id;
}

export async function mergeGuestCart(customerId: string, anonymousToken?: string) {
  if (!anonymousToken) return;
  const pool = await getDb();
  const customerCartId = await findOrCreateCart(customerId);
  const guest = await pool.request().input('anonymousToken', anonymousToken).query<{ id: string }>(`
    SELECT TOP 1 id FROM carts WHERE anonymous_token = @anonymousToken AND customer_id IS NULL;
  `);
  const guestCartId = guest.recordset[0]?.id;
  if (!guestCartId || guestCartId === customerCartId) return;

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const request = new sql.Request(tx);
    request.input('guestCartId', guestCartId).input('customerCartId', customerCartId);
    await request.query(`
      MERGE cart_items AS target
      USING (SELECT variant_id, quantity FROM cart_items WHERE cart_id = @guestCartId) AS source
      ON target.cart_id = @customerCartId AND target.variant_id = source.variant_id
      WHEN MATCHED THEN UPDATE SET quantity = target.quantity + source.quantity, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (id, cart_id, variant_id, quantity) VALUES (NEWID(), @customerCartId, source.variant_id, source.quantity);
      DELETE FROM cart_items WHERE cart_id = @guestCartId;
      DELETE FROM carts WHERE id = @guestCartId;
      UPDATE carts SET updated_at = SYSUTCDATETIME() WHERE id = @customerCartId;
    `);
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

export async function getCart(customerId?: string | null, anonymousToken?: string | null): Promise<Cart> {
  const cartId = await findOrCreateCart(customerId, anonymousToken);
  if (!cartId) return { id: '', items: [], subtotalInr: 0, count: 0 };

  const pool = await getDb();
  const result = await pool.request().input('cartId', cartId).query<CartItem & { priceInr: number; totalInr: number }>(`
    SELECT
      ci.id,
      ci.variant_id AS variantId,
      p.slug,
      p.name,
      v.size,
      v.color,
      CAST(p.price_inr AS int) AS priceInr,
      ci.quantity,
      (
        SELECT TOP 1 pi.url FROM product_images pi
        WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC
      ) AS imageUrl,
      CAST(p.price_inr * ci.quantity AS int) AS totalInr
    FROM cart_items ci
    INNER JOIN product_variants v ON v.id = ci.variant_id
    INNER JOIN products p ON p.id = v.product_id
    WHERE ci.cart_id = @cartId
    ORDER BY ci.created_at ASC;
  `);
  const items = result.recordset;
  return {
    id: cartId,
    items,
    subtotalInr: items.reduce((sum, item) => sum + item.totalInr, 0),
    count: items.reduce((sum, item) => sum + item.quantity, 0)
  };
}

export async function addToCart(customerId: string | null, anonymousToken: string | null, variantId: string, quantity = 1) {
  if (quantity < 1 || quantity > 20) throw new Error('Quantity must be between 1 and 20.');
  const cartId = await findOrCreateCart(customerId, anonymousToken);
  if (!cartId) throw new Error('Cart token is required for a guest cart.');

  const pool = await getDb();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const request = new sql.Request(tx);
    request.input('variantId', variantId).input('cartId', cartId);
    const variant = await request.query<{ available: number; priceInr: number }>(`
      SELECT CAST(i.quantity_available - i.quantity_reserved AS int) AS available, CAST(p.price_inr AS int) AS priceInr
      FROM product_variants v
      INNER JOIN products p ON p.id = v.product_id AND p.is_active = 1
      INNER JOIN inventory i ON i.variant_id = v.id
      WHERE v.id = @variantId;
    `);
    const row = variant.recordset[0];
    if (!row) throw new Error('Product variant not found.');

    const existing = await new sql.Request(tx)
      .input('cartId', cartId).input('variantId', variantId)
      .query<{ quantity: number }>('SELECT quantity FROM cart_items WHERE cart_id = @cartId AND variant_id = @variantId');
    const current = existing.recordset[0]?.quantity ?? 0;
    if (current + quantity > row.available) throw new Error(`Only ${row.available} item(s) are available.`);

    const upsert = new sql.Request(tx)
      .input('cartId', cartId).input('variantId', variantId).input('quantity', quantity);
    await upsert.query(`
      IF EXISTS (SELECT 1 FROM cart_items WHERE cart_id = @cartId AND variant_id = @variantId)
        UPDATE cart_items SET quantity = quantity + @quantity, updated_at = SYSUTCDATETIME()
        WHERE cart_id = @cartId AND variant_id = @variantId;
      ELSE
        INSERT INTO cart_items (id, cart_id, variant_id, quantity) VALUES (NEWID(), @cartId, @variantId, @quantity);
      UPDATE carts SET updated_at = SYSUTCDATETIME() WHERE id = @cartId;
    `);
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  return getCart(customerId, anonymousToken);
}

export async function updateCartItem(customerId: string | null, anonymousToken: string | null, itemId: string, quantity: number) {
  if (quantity < 1 || quantity > 20) throw new Error('Quantity must be between 1 and 20.');
  const cart = await getCart(customerId, anonymousToken);
  const item = cart.items.find((x) => x.id === itemId);
  if (!item) throw new Error('Cart item not found.');
  const pool = await getDb();
  const availability = await pool.request().input('variantId', item.variantId).query<{ available: number }>(`
    SELECT CAST(quantity_available - quantity_reserved AS int) AS available FROM inventory WHERE variant_id = @variantId;
  `);
  if ((availability.recordset[0]?.available ?? 0) < quantity) throw new Error('Requested quantity is not available.');
  await pool.request().input('itemId', itemId).input('quantity', quantity).query(`
    UPDATE cart_items SET quantity = @quantity, updated_at = SYSUTCDATETIME() WHERE id = @itemId;
  `);
  return getCart(customerId, anonymousToken);
}

export async function removeCartItem(customerId: string | null, anonymousToken: string | null, itemId: string) {
  const cart = await getCart(customerId, anonymousToken);
  if (!cart.items.some((x) => x.id === itemId)) throw new Error('Cart item not found.');
  const pool = await getDb();
  await pool.request().input('itemId', itemId).query(`DELETE FROM cart_items WHERE id = @itemId`);
  return getCart(customerId, anonymousToken);
}
