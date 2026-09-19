import { env } from "../config.js";
import { getDb } from "../db.js";

type OrderEmailStatus =
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "REFUND_FAILED";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value: unknown): string {
  return `₹${Number(value ?? 0).toFixed(2)}`;
}

function getOrderUrl(orderId: string) {
  return `${env.PUBLIC_WEB_URL.replace(/\/$/, "")}/account/orders/${encodeURIComponent(orderId)}`;
}

function emailLayout(content: string) {
  return `
    <div style="margin:0;padding:40px 20px;background:#fffaf4;font-family:Arial,sans-serif;color:#332c28">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #eadfd5;border-radius:24px;padding:40px">

        <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8b7a70">
          SmolStudio
        </p>

        ${content}

        <div style="margin-top:36px;padding-top:24px;border-top:1px solid #eee5de">
          <p style="margin:0;font-size:13px;line-height:1.7;color:#8b7a70">
            Thank you for shopping with SmolStudio.
          </p>
        </div>

      </div>
    </div>
  `;
}

export async function sendEmail(
  customerId: string | null,
  orderId: string | null,
  to: string,
  subject: string,
  html: string,
  template: string,
) {
  if (!env.RESEND_API_KEY) {
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        subject,
        html,
      }),
    });

    const text = await response.text();

    const pool = await getDb();

    await pool
      .request()
      .input("customerId", customerId)
      .input("orderId", orderId)
      .input("channel", "EMAIL")
      .input("template", template)
      .input("recipient", to)
      .input("status", response.ok ? "SENT" : "FAILED")
      .input("error", response.ok ? null : text.slice(0, 1000))
      .query(
        `
        INSERT INTO notification_log(
          customer_id,
          order_id,
          channel,
          template,
          recipient,
          status,
          error_message
        )
        VALUES(
          @customerId,
          @orderId,
          @channel,
          @template,
          @recipient,
          @status,
          @error
        )
        `,
      );

    return response.ok;
  } catch (error) {
    try {
      const pool = await getDb();

      await pool
        .request()
        .input("customerId", customerId)
        .input("orderId", orderId)
        .input("channel", "EMAIL")
        .input("template", template)
        .input("recipient", to)
        .input("status", "FAILED")
        .input("error", error instanceof Error ? error.message : "Email failed")
        .query(
          `
          INSERT INTO notification_log(
            customer_id,
            order_id,
            channel,
            template,
            recipient,
            status,
            error_message
          )
          VALUES(
            @customerId,
            @orderId,
            @channel,
            @template,
            @recipient,
            @status,
            @error
          )
          `,
        );
    } catch {}

    return false;
  }
}

async function getOrderEmailData(orderId: string) {
  const pool = await getDb();

  const order = (
    await pool
      .request()
      .input("id", orderId)
      .query<any>(
        `
        SELECT TOP 1
          o.id,
          o.order_number orderNumber,
          o.customer_id customerId,

          c.email,
          c.first_name firstName,
          c.last_name lastName,

          o.status,
          o.currency,

          CAST(o.subtotal_inr AS decimal(12,2)) subtotalInr,
          CAST(o.shipping_inr AS decimal(12,2)) shippingInr,
          CAST(o.discount_inr AS decimal(12,2)) discountInr,
          CAST(o.tax_inr AS decimal(12,2)) taxInr,
          CAST(o.total_inr AS decimal(12,2)) totalInr,
          CAST(o.store_credit_applied_inr AS decimal(12,2)) storeCreditAppliedInr,

          o.shipping_address_json shippingAddressJson,
          o.payment_provider paymentProvider,
          o.payment_status paymentStatus,
          o.coupon_code couponCode,

          o.tracking_number trackingNumber,
          o.carrier,
          o.tracking_url trackingUrl,

          o.created_at createdAt
        FROM orders o
        LEFT JOIN customers c
          ON c.id = o.customer_id
        WHERE o.id = @id
        `,
      )
  ).recordset[0];

  if (!order?.email) {
    return null;
  }

  const items = (
    await pool
      .request()
      .input("orderId", orderId)
      .query<any>(
        `
        SELECT
          product_name productName,
          sku,
          quantity,
          CAST(unit_price_inr AS decimal(12,2)) unitPriceInr,
          CAST(total_price_inr AS decimal(12,2)) totalPriceInr
        FROM order_items
        WHERE order_id = @orderId
        ORDER BY id
        `,
      )
  ).recordset;

  let shippingAddress: any = {};

  try {
    shippingAddress = JSON.parse(order.shippingAddressJson || "{}");
  } catch {}

  return {
    ...order,
    items,
    shippingAddress,
  };
}

export async function sendStoreCreditRestoreEmail(
  orderId: string,
  amountInr: number,
  balanceAfterInr: number,
) {
  const order = await getOrderEmailData(orderId);

  if (!order) {
    return false;
  }

  const customerName = [order.firstName, order.lastName]
    .filter(Boolean)
    .join(" ");

  const subject = `Store credit returned - ${order.orderNumber}`;

  const html = emailLayout(`
    <h1
      style="
        margin:12px 0 0;
        font-family:Georgia,serif;
        font-size:32px;
        font-weight:500;
        color:#5e473c
      "
    >
      Store credit returned
    </h1>

    <p
      style="
        margin:24px 0 0;
        font-size:15px;
        line-height:1.7;
        color:#5f554f
      "
    >
      ${customerName ? `Hi ${escapeHtml(customerName)},` : "Hello,"}
    </p>

    <p
      style="
        margin:12px 0 0;
        font-size:15px;
        line-height:1.7;
        color:#5f554f
      "
    >
      ${money(amountInr)} in store credit has been
      returned to your account because your order was
      cancelled.
    </p>

    <div
      style="
        margin:28px 0;
        padding:24px;
        background:#fffaf4;
        border-radius:16px;
        text-align:center
      "
    >
      <p
        style="
          margin:0;
          font-size:12px;
          letter-spacing:1.5px;
          text-transform:uppercase;
          color:#8b7a70
        "
      >
        Store credit returned
      </p>

      <p
        style="
          margin:10px 0 0;
          font-size:28px;
          color:#5e473c;
          font-weight:600
        "
      >
        ${money(amountInr)}
      </p>

      <p
        style="
          margin:14px 0 0;
          font-size:14px;
          color:#8b7a70
        "
      >
        New store credit balance:
        <strong>${money(balanceAfterInr)}</strong>
      </p>
    </div>

    <div
      style="
        margin:28px 0;
        padding:20px;
        background:#fffaf4;
        border-radius:16px
      "
    >
      <p
        style="
          margin:0;
          font-size:12px;
          letter-spacing:1.5px;
          text-transform:uppercase;
          color:#8b7a70
        "
      >
        Cancelled order
      </p>

      <p
        style="
          margin:8px 0 0;
          font-size:20px;
          color:#5e473c;
          font-weight:600
        "
      >
        ${escapeHtml(order.orderNumber)}
      </p>
    </div>

    <div style="margin:28px 0">
      <a
        href="${escapeHtml(getOrderUrl(order.id))}"
        style="
          display:inline-block;
          background:#5e473c;
          color:#ffffff;
          text-decoration:none;
          padding:14px 24px;
          border-radius:999px;
          font-size:14px
        "
      >
        View your order
      </a>
    </div>
  `);

  return sendEmail(
    order.customerId,
    orderId,
    order.email,
    subject,
    html,
    "STORE_CREDIT_RESTORE",
  );
}

function renderAddress(address: any) {
  const parts = [
    address.recipientName,
    address.name,
    address.line1,
    address.addressLine1,
    address.line2,
    address.addressLine2,
    address.city,
    address.state,
    address.postalCode,
    address.phone,
  ].filter(Boolean);

  return parts.map((part) => `<div>${escapeHtml(part)}</div>`).join("");
}

function renderItems(items: any[]) {
  return items
    .map(
      (item) => `
        <tr>
          <td style="padding:14px 8px;border-bottom:1px solid #eee5de">
            <strong style="color:#4d3b32">
              ${escapeHtml(item.productName)}
            </strong>

            ${
              item.sku
                ? `
                  <div style="font-size:12px;color:#9a8c83;margin-top:4px">
                    SKU: ${escapeHtml(item.sku)}
                  </div>
                `
                : ""
            }
          </td>

          <td style="padding:14px 8px;text-align:center;border-bottom:1px solid #eee5de">
            ${Number(item.quantity)}
          </td>

          <td style="padding:14px 8px;text-align:right;border-bottom:1px solid #eee5de">
            ${money(item.totalPriceInr)}
          </td>
        </tr>
      `,
    )
    .join("");
}

export async function sendOrderStatusEmail(orderId: string, status: string) {
  const order = await getOrderEmailData(orderId);

  if (!order) {
    return false;
  }

  const normalizedStatus = String(status)
    .trim()
    .toUpperCase() as OrderEmailStatus;

  const subjects: Record<string, string> = {
    PAID: `Order confirmed - ${order.orderNumber}`,
    PROCESSING: `Your order is being prepared - ${order.orderNumber}`,
    SHIPPED: `Your order has shipped - ${order.orderNumber}`,
    DELIVERED: `Your order has been delivered - ${order.orderNumber}`,
    CANCELLED: `Order cancelled - ${order.orderNumber}`,
    REFUND_PENDING: `Refund initiated - ${order.orderNumber}`,
    REFUNDED: `Refund completed - ${order.orderNumber}`,
    PARTIALLY_REFUNDED: `Partial refund completed - ${order.orderNumber}`,
    REFUND_FAILED: `Refund update - ${order.orderNumber}`,
  };

  const headings: Record<string, string> = {
    PAID: "Your order is confirmed",
    PROCESSING: "Your order is being prepared",
    SHIPPED: "Your order is on the way",
    DELIVERED: "Your order has been delivered",
    CANCELLED:
      "Your order has been cancelled. We apologize for any inconvenience caused.",
    REFUND_PENDING: "Your refund has been initiated",
    REFUNDED: "Your refund has been completed",
    PARTIALLY_REFUNDED: "Your partial refund has been completed",
    REFUND_FAILED: "There was an issue processing your refund",
  };

  const descriptions: Record<string, string> = {
    PAID: "Thank you for your order. We have successfully received your payment.",

    PROCESSING: "Your order is now being prepared for shipment.",

    SHIPPED: "Your order has left our facility and is on its way to you.",

    DELIVERED:
      "Your order has been marked as delivered. We hope you enjoy your purchase.",

    CANCELLED: "Your order has been cancelled.",

    REFUND_PENDING:
      "Your refund has been initiated. Razorpay is processing the refund. The final credit time depends on your bank or payment provider.",

    REFUNDED:
      "Your refund has been successfully processed. The amount should appear according to your bank or payment provider's processing time.",

    PARTIALLY_REFUNDED:
      "A partial refund for your order has been successfully processed.",

    REFUND_FAILED:
      "We were unable to complete your refund through the payment provider. Our team will need to review the refund.",
  };

  const tracking =
    normalizedStatus === "SHIPPED" && order.trackingUrl
      ? `
        <div style="margin:28px 0">
          <a
            href="${escapeHtml(order.trackingUrl)}"
            style="display:inline-block;background:#5e473c;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:999px;font-size:14px"
          >
            Track your shipment
          </a>

          ${
            order.carrier || order.trackingNumber
              ? `
                <p style="margin:12px 0 0;font-size:13px;color:#8b7a70">
                  ${order.carrier ? `Carrier: ${escapeHtml(order.carrier)}` : ""}
                  ${
                    order.trackingNumber
                      ? ` · Tracking: ${escapeHtml(order.trackingNumber)}`
                      : ""
                  }
                </p>
              `
              : ""
          }
        </div>
      `
      : "";

  const orderButton = `
    <div style="margin:28px 0">
      <a
        href="${escapeHtml(getOrderUrl(order.id))}"
        style="display:inline-block;background:#5e473c;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:999px;font-size:14px"
      >
        View your order
      </a>
    </div>
  `;

  const customerName = [order.firstName, order.lastName]
    .filter(Boolean)
    .join(" ");

  const html = emailLayout(`
    <h1 style="margin:12px 0 0;font-family:Georgia,serif;font-size:32px;font-weight:500;color:#5e473c">
      ${escapeHtml(headings[normalizedStatus] || "Order update")}
    </h1>

    <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#5f554f">
      ${customerName ? `Hi ${escapeHtml(customerName)},` : "Hello,"}
    </p>

    <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:#5f554f">
      ${escapeHtml(
        descriptions[normalizedStatus] || "There is an update on your order.",
      )}
    </p>

    <div style="margin:28px 0;padding:20px;background:#fffaf4;border-radius:16px">
      <p style="margin:0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#8b7a70">
        Order
      </p>

      <p style="margin:8px 0 0;font-size:20px;color:#5e473c;font-weight:600">
        ${escapeHtml(order.orderNumber)}
      </p>
    </div>

    ${
      order.items?.length
        ? `
          <h2 style="margin:30px 0 12px;font-family:Georgia,serif;font-size:21px;font-weight:500;color:#5e473c">
            Order summary
          </h2>

          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#5f554f">
            <thead>
              <tr>
                <th style="padding:10px 8px;text-align:left;border-bottom:1px solid #eadfd5">
                  Item
                </th>

                <th style="padding:10px 8px;text-align:center;border-bottom:1px solid #eadfd5">
                  Qty
                </th>

                <th style="padding:10px 8px;text-align:right;border-bottom:1px solid #eadfd5">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              ${renderItems(order.items)}
            </tbody>
          </table>
        `
        : ""
    }

    <div style="margin:24px 0">
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#5f554f">

        <tr>
          <td style="padding:6px 0">Subtotal</td>
          <td style="padding:6px 0;text-align:right">
            ${money(order.subtotalInr)}
          </td>
        </tr>

        ${
          Number(order.discountInr) > 0
            ? `
              <tr>
                <td style="padding:6px 0">
                  Discount${
                    order.couponCode ? ` (${escapeHtml(order.couponCode)})` : ""
                  }
                </td>

                <td style="padding:6px 0;text-align:right">
                  -${money(order.discountInr)}
                </td>
              </tr>
            `
            : ""
        }

        <tr>
          <td style="padding:6px 0">Shipping</td>
          <td style="padding:6px 0;text-align:right">
            ${money(order.shippingInr)}
          </td>
        </tr>

        ${
          Number(order.taxInr) > 0
            ? `
              <tr>
                <td style="padding:6px 0">Tax</td>
                <td style="padding:6px 0;text-align:right">
                  ${money(order.taxInr)}
                </td>
              </tr>
            `
            : ""
        }

        ${
          Number(order.storeCreditAppliedInr) > 0
            ? `
              <tr>
                <td style="padding:6px 0">Store credit</td>
                <td style="padding:6px 0;text-align:right">
                  -${money(order.storeCreditAppliedInr)}
                </td>
              </tr>
            `
            : ""
        }

                <tr>
          <td style="padding:12px 0 0;border-top:1px solid #eadfd5;font-weight:600;color:#4d3b32">
            Amount paid
          </td>

          <td style="padding:12px 0 0;border-top:1px solid #eadfd5;text-align:right;font-weight:600;color:#4d3b32">
            ${money(
              Number(order.totalInr) - Number(order.storeCreditAppliedInr || 0),
            )}
          </td>
        </tr>

      </table>
    </div>

    ${
      ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(normalizedStatus)
        ? `
          <h2 style="margin:30px 0 12px;font-family:Georgia,serif;font-size:21px;font-weight:500;color:#5e473c">
            Delivery address
          </h2>

          <div style="font-size:14px;line-height:1.7;color:#5f554f">
            ${renderAddress(order.shippingAddress)}
          </div>
        `
        : ""
    }

    ${tracking}

    ${orderButton}
  `);

  return sendEmail(
    order.customerId,
    orderId,
    order.email,
    subjects[normalizedStatus] || `Order update - ${order.orderNumber}`,
    html,
    `ORDER_${normalizedStatus}`,
  );
}
