import { GraphQLError } from "graphql";
import { createSchema } from "graphql-yoga";
import {
  getProduct,
  listCategories,
  listProducts,
} from "../catalog/service.js";
import {
  deleteAdminProduct,
  deleteProductImage,
  deleteVariant,
  getAdminProduct,
  listAdminProducts,
  reorderProductImages,
  saveAdminProduct,
  saveVariant,
  setPrimaryProductImage,
  uploadProductImage,
} from "../catalog/admin-service.js";
import { requireAdmin, requireUser, type AuthUser } from "../auth/service.js";
import {
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from "../auth/service.js";
import {
  addToCart,
  getCart,
  mergeGuestCart,
  removeCartItem,
  updateCartItem,
} from "../cart/service.js";
import {
  cancelCustomerOrder,
  createPaymentOrder,
  getCustomerOrder,
  handleRazorpayWebhook,
  listCustomerOrders,
  listCustomerReturns,
  previewCheckout,
  requestItemAfterSales,
  requestReturn,
  verifyPayment,
  getStoreCreditInfo,
} from "../orders/service.js";
import {
  adminDashboardStats,
  adminRefundOrder,
  deleteAddress,
  deleteCategory,
  deleteCoupon,
  getAdminCustomer,
  getAdminOrder,
  listAddresses,
  listAdminCustomers,
  listAdminOrders,
  listCategoriesAdmin,
  listCoupons,
  listReturnRequests,
  saveAddress,
  saveCategory,
  saveCoupon,
  updateAdminOrder,
  updateReturnRequest,
} from "../admin/service.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getDb } from "../db.js";
import {
  addToWishlist,
  listWishlist,
  removeFromWishlist,
  isProductWishlisted,
} from "../wishlist/service.js";

export type GraphQLContext = {
  request: FastifyRequest;
  reply: FastifyReply;
  user: AuthUser | null;
  anonymousToken: string | undefined;
};

function safeError(error: unknown): never {
  throw new GraphQLError(
    error instanceof Error ? error.message : "Request failed.",
  );
}

export const typeDefs = /* GraphQL */ `
  type Category {
    id: ID!
    slug: String!
    name: String!
  }

  type AdminCategory {
    id: ID!
    slug: String!
    name: String!
    sortOrder: Int!
    isActive: Boolean!
  }

  type Variant {
    id: ID!
    size: String!
    color: String!
    stock: Int!
  }

  type ProductImage {
    id: ID!
    url: String!
    storageKey: String
    altText: String
    sortOrder: Int!
    isPrimary: Boolean!
  }

  type AdminVariant {
    id: ID!
    sku: String!
    size: String!
    color: String!
    stock: Int!
  }

  type AdminProduct {
    id: ID!
    slug: String!
    name: String!
    description: String
    priceInr: Int!
    compareAtPriceInr: Int
    sku: String!
    isActive: Boolean!
    categoryId: ID!
    categorySlug: String!
    categoryName: String!
    imageUrl: String
    stock: Int
    images: [ProductImage!]!
    variants: [AdminVariant!]!
  }

  type Product {
    id: ID!
    slug: String!
    name: String!
    description: String
    priceInr: Int!
    compareAtPriceInr: Int
    imageUrl: String
    images: [ProductImage!]!
    categorySlug: String!
    sku: String!
    sizes: [String!]!
    colors: [String!]!
    stock: Int!
    variants: [Variant!]!
  }

  type User {
    id: ID!
    email: String!
    firstName: String
    lastName: String
    role: String!
  }

  type CartItem {
    id: ID!
    variantId: ID!
    slug: String!
    name: String!
    size: String!
    color: String!
    priceInr: Int!
    quantity: Int!
    imageUrl: String
    totalInr: Int!
  }

  type Cart {
    id: ID!
    items: [CartItem!]!
    subtotalInr: Int!
    count: Int!
  }

  type AuthPayload {
    user: User!
    cart: Cart!
  }

  type CheckoutTotals {
    subtotalInr: Float!
    shippingInr: Float!
    discountInr: Float!
    taxInr: Float!
    totalInr: Float!
    storeCreditAppliedInr: Float!
    payableInr: Float!
    couponCode: String
  }

  type PaymentOrder {
    orderId: ID!
    orderNumber: String!
    amount: Int!
    currency: String!
    razorpayOrderId: String!
    keyId: String!
    subtotalInr: Float!
    shippingInr: Float!
    discountInr: Float!
    taxInr: Float!
    totalInr: Float!
    storeCreditAppliedInr: Float!
    payableInr: Float!
    couponCode: String
  }

  type OrderItem {
    id: ID!
    productName: String!
    sku: String!
    quantity: Int!
    unitPriceInr: Float!
    totalPriceInr: Float!
  }

  type ShippingAddress {
    recipientName: String
    line1: String
    line2: String
    city: String
    state: String
    postalCode: String
    countryCode: String
    phone: String
  }

  type Address {
    id: ID!
    label: String
    recipientName: String!
    line1: String!
    line2: String
    city: String!
    state: String!
    postalCode: String!
    countryCode: String!
    phone: String
  }

  type OrderHistory {
    status: String!
    note: String
    createdAt: String!
  }

  type Refund {
    id: ID!
    refundId: String
    amountInr: Float!
    status: String!
    reason: String
    createdAt: String!
  }

  type Order {
    id: ID!
    orderNumber: String!
    status: String!
    paymentStatus: String!
    currency: String!
    subtotalInr: Float!
    shippingInr: Float!
    discountInr: Float!
    taxInr: Float!
    totalInr: Float!
    shippingAddress: ShippingAddress!
    trackingNumber: String
    carrier: String
    trackingUrl: String
    createdAt: String!
    shippedAt: String
    deliveredAt: String
    items: [OrderItem!]!
  }

  type AdminOrder {
    id: ID!
    orderNumber: String!
    status: String!
    paymentStatus: String!
    paymentProvider: String
    paymentReference: String
    paymentOrderId: String

    subtotalInr: Float!
    shippingInr: Float!
    discountInr: Float!
    taxInr: Float!
    totalInr: Float!

    currency: String!
    trackingNumber: String
    carrier: String
    trackingUrl: String

    createdAt: String!
    updatedAt: String!
    shippedAt: String
    deliveredAt: String
    cancelledAt: String
    cancelReason: String
    couponCode: String

    customerId: ID
    customerEmail: String
    firstName: String
    lastName: String
    customerPhone: String

    shippingAddress: Address!
    items: [OrderItem!]!
    history: [OrderHistory!]!
    refunds: [Refund!]!
  }

  type CustomerOrderSummary {
    id: ID!
    orderNumber: String!
    status: String!
    paymentStatus: String!
    totalInr: Float!
    createdAt: String!
  }

  type AdminCustomer {
    id: ID!
    email: String!
    phone: String
    firstName: String
    lastName: String
    role: String!
    createdAt: String!
    orderCount: Int
    totalSpentInr: Float
    orders: [CustomerOrderSummary!]!
    addresses: [Address!]!
  }

  type AdminStats {
    productCount: Int!
    activeProductCount: Int!
    customerCount: Int!
    orderCount: Int!
    pendingOrderCount: Int!
    revenueInr: Float!
    returnRequestCount: Int!
    outOfStockCount: Int!
  }

  type Coupon {
    id: ID!
    code: String!
    discountType: String!
    discountValue: Float!
    minOrderInr: Float!
    maxDiscountInr: Float
    maxRedemptions: Int
    redeemedCount: Int!
    startsAt: String!
    endsAt: String
    isActive: Boolean!
  }

  type ReturnRequest {
    id: ID!
    orderId: ID!
    orderNumber: String!
    customerId: ID!
    customerEmail: String

    orderItemId: ID
    requestType: String
    requestedSize: String

    reason: String!
    status: String!

    refundAmountInr: Float
    approvedCreditInr: Float

    replacementVariantId: ID
    replacementOrderId: ID

    adminNote: String
    adminReviewedAt: String
    adminReviewedBy: ID
    replacementFulfilledAt: String

    createdAt: String!
    updatedAt: String!
  }

  type AfterSalesRequest {
    id: ID!
    orderId: ID!
    orderItemId: ID!
    requestType: String!
    requestedSize: String
    calculatedPaidAmountInr: Float!
    status: String!
  }

  type StoreCreditTransaction {
    id: ID!
    type: String!
    amountInr: Float!
    balanceAfterInr: Float!
    orderId: ID
    description: String
    createdAt: String!
  }

  type StoreCredit {
    balanceInr: Float!
    reservedInr: Float!
    availableInr: Float!
    transactions: [StoreCreditTransaction!]!
  }

  type WishlistItem {
    id: ID!
    slug: String!
    name: String!
    description: String
    priceInr: Int!
    compareAtPriceInr: Int
    imageUrl: String
    categorySlug: String
    sku: String!
  }

  type Query {
    health: String!
    categories: [Category!]!
    products(limit: Int = 24, categorySlug: String, search: String): [Product!]!
    product(slug: String!): Product
    me: User
    cart: Cart!

    myWishlist: [WishlistItem!]!
    isWishlisted(productId: ID!): Boolean!

    adminProducts(search: String, active: Boolean): [AdminProduct!]!
    adminProduct(id: ID): AdminProduct

    myOrders: [Order!]!
    myOrder(id: ID!): Order
    myStoreCredit: StoreCredit!

    adminOrders(search: String, status: String): [AdminOrder!]!
    adminOrder(id: ID!): AdminOrder

    adminCustomers(search: String): [AdminCustomer!]!
    adminCustomer(id: ID!): AdminCustomer

    adminStats: AdminStats!

    checkoutTotals(couponCode: String): CheckoutTotals!

    myAddresses: [Address!]!
    myReturns: [ReturnRequest!]!

    adminCategories: [AdminCategory!]!
    adminCoupons: [Coupon!]!
    adminReturns(status: String): [ReturnRequest!]!
  }

  type Mutation {
    register(
      email: String!
      password: String!
      firstName: String
      lastName: String
    ): AuthPayload!

    login(email: String!, password: String!): AuthPayload!

    forgotPassword(email: String!): Boolean!

    resetPassword(token: String!, newPassword: String!): Boolean!

    logout: Boolean!

    addToCart(variantId: ID!, quantity: Int = 1): Cart!

    updateCartItem(itemId: ID!, quantity: Int!): Cart!

    removeCartItem(itemId: ID!): Cart!

    saveAdminProduct(
      id: ID
      name: String!
      slug: String!
      description: String
      priceInr: Int!
      compareAtPriceInr: Int
      sku: String!
      categoryId: ID!
      isActive: Boolean!
    ): AdminProduct!

    deleteAdminProduct(id: ID!): Boolean!

    saveAdminVariant(
      id: ID
      productId: ID!
      sku: String!
      size: String!
      color: String!
      stock: Int!
    ): AdminProduct!

    deleteAdminVariant(id: ID!): AdminProduct!

    uploadProductImage(
      productId: ID!
      filename: String!
      contentType: String!
      dataBase64: String!
      altText: String
    ): AdminProduct!

    deleteProductImage(id: ID!): AdminProduct!

    setPrimaryProductImage(id: ID!): AdminProduct!

    reorderProductImages(productId: ID!, imageIds: [ID!]!): AdminProduct!

    createPaymentOrder(
      recipientName: String!
      line1: String!
      line2: String
      city: String!
      state: String!
      postalCode: String!
      countryCode: String
      phone: String
      couponCode: String
    ): PaymentOrder!

    verifyPayment(
      orderId: ID!
      razorpayOrderId: String!
      razorpayPaymentId: String!
      razorpaySignature: String!
    ): Order!

    cancelMyOrder(id: ID!, reason: String!): Order!

    requestReturn(orderId: ID!, reason: String!): Boolean!

    requestItemAfterSales(
      orderId: ID!
      orderItemId: ID!
      requestType: String!
      reason: String!
      requestedSize: String
    ): AfterSalesRequest!

    saveAddress(
      id: ID
      label: String
      recipientName: String!
      line1: String!
      line2: String
      city: String!
      state: String!
      postalCode: String!
      countryCode: String
      phone: String
    ): [Address!]!

    deleteAddress(id: ID!): [Address!]!

    updateAdminOrder(
      id: ID!
      status: String!
      trackingNumber: String
      carrier: String
      trackingUrl: String
      note: String
    ): AdminOrder!

    refundOrder(id: ID!, amountInr: Int!, reason: String!): AdminOrder!

    saveCategory(
      id: ID
      name: String!
      slug: String
      sortOrder: Int
      isActive: Boolean
    ): [AdminCategory!]!

    deleteCategory(id: ID!): Boolean!

    saveCoupon(
      id: ID
      code: String!
      discountType: String!
      discountValue: Float!
      minOrderInr: Float
      maxDiscountInr: Float
      maxRedemptions: Int
      startsAt: String!
      endsAt: String
      isActive: Boolean
    ): [Coupon!]!

    deleteCoupon(id: ID!): Boolean!

    updateReturnRequest(id: ID!, status: String!, adminNote: String): Boolean!

    addToWishlist(productId: ID!): [WishlistItem!]!

    removeFromWishlist(productId: ID!): [WishlistItem!]!
  }
`;

export const schema = createSchema<GraphQLContext>({
  typeDefs,

  resolvers: {
    Query: {
      health: () => "ok",

      categories: () => listCategories(),

      products: (_: unknown, args: any) =>
        listProducts(
          Math.min(Math.max(args.limit ?? 24, 1), 60),
          args.categorySlug,
          args.search,
        ),

      product: (_: unknown, args: any) => getProduct(args.slug),

      me: (_: unknown, __: unknown, ctx) => ctx.user,

      cart: (_: unknown, __: unknown, ctx) =>
        getCart(ctx.user?.id ?? null, ctx.anonymousToken ?? null),

      adminProducts: async (_: unknown, args: any, ctx) => {
        requireAdmin(ctx.user);
        return listAdminProducts(args.search, args.active);
      },

      adminProduct: async (_: unknown, args: any, ctx) => {
        requireAdmin(ctx.user);
        return getAdminProduct(args.id);
      },

      myOrders: async (_: unknown, __: unknown, ctx) => {
        const u = requireUser(ctx.user);
        return listCustomerOrders(u.id);
      },

      myOrder: async (_: unknown, args: any, ctx) => {
        const u = requireUser(ctx.user);
        return getCustomerOrder(u.id, args.id);
      },

      adminOrders: async (_: unknown, args: any, ctx) => {
        requireAdmin(ctx.user);
        return listAdminOrders(args.search, args.status);
      },

      adminOrder: async (_: unknown, args: any, ctx) => {
        requireAdmin(ctx.user);
        return getAdminOrder(args.id);
      },

      adminCustomers: async (_: unknown, args: any, ctx) => {
        requireAdmin(ctx.user);
        return listAdminCustomers(args.search);
      },

      adminCustomer: async (_: unknown, args: any, ctx) => {
        requireAdmin(ctx.user);
        return getAdminCustomer(args.id);
      },

      adminStats: async (_: unknown, __: unknown, ctx) => {
        requireAdmin(ctx.user);
        return adminDashboardStats();
      },

      checkoutTotals: async (_: unknown, args: any, ctx) => {
        try {
          const u = requireUser(ctx.user);

          return await previewCheckout(u.id, args.couponCode);
        } catch (e) {
          return safeError(e);
        }
      },

      myAddresses: async (_: unknown, __: unknown, ctx) => {
        const u = requireUser(ctx.user);
        return listAddresses(u.id);
      },

      myReturns: async (_: unknown, __: unknown, ctx) => {
        const u = requireUser(ctx.user);
        return listCustomerReturns(u.id);
      },

      adminCategories: async (_: unknown, __: unknown, ctx) => {
        requireAdmin(ctx.user);
        return listCategoriesAdmin();
      },

      adminCoupons: async (_: unknown, __: unknown, ctx) => {
        requireAdmin(ctx.user);
        return listCoupons();
      },

      adminReturns: async (_: unknown, args: any, ctx) => {
        requireAdmin(ctx.user);
        return listReturnRequests(args.status);
      },

      myStoreCredit: async (_: unknown, __: unknown, ctx) => {
        const u = requireUser(ctx.user);
        const pool = await getDb();

        const credit = await getStoreCreditInfo(pool, u.id);

        return {
          balanceInr: credit.balanceInr,
          reservedInr: credit.reservedInr,
          availableInr: credit.availableInr,
          transactions: credit.transactions,
        };
      },

      myWishlist: async (_: unknown, __: unknown, ctx) => {
        const u = requireUser(ctx.user);

        return listWishlist(u.id);
      },

      isWishlisted: async (_: unknown, args: any, ctx) => {
        const u = requireUser(ctx.user);

        return isProductWishlisted(u.id, args.productId);
      },
    },

    Mutation: {
      register: async (_: unknown, args: any, ctx) => {
        try {
          const user = await registerUser(args, ctx.reply);

          await mergeGuestCart(user.id, ctx.anonymousToken);

          return {
            user,
            cart: await getCart(user.id, null),
          };
        } catch (e) {
          return safeError(e);
        }
      },

      login: async (_: unknown, args: any, ctx) => {
        try {
          const user = await loginUser(args.email, args.password, ctx.reply);

          await mergeGuestCart(user.id, ctx.anonymousToken);

          return {
            user,
            cart: await getCart(user.id, null),
          };
        } catch (e) {
          return safeError(e);
        }
      },

      forgotPassword: async (_: unknown, args: any) => {
        try {
          await requestPasswordReset(args.email);
          return true;
        } catch (e) {
          console.error("Password reset email failed:", e);

          throw new GraphQLError(
            "We couldn't send the password reset email. Please try again later.",
          );
        }
      },

      resetPassword: async (_: unknown, args: any) => {
        try {
          await resetPassword(args.token, args.newPassword);

          return true;
        } catch (e) {
          return safeError(e);
        }
      },

      logout: async (_: unknown, __: unknown, ctx) => {
        try {
          await logoutUser(ctx.request, ctx.reply);

          return true;
        } catch (e) {
          return safeError(e);
        }
      },

      addToCart: async (_: unknown, args: any, ctx) => {
        try {
          return await addToCart(
            ctx.user?.id ?? null,
            ctx.anonymousToken ?? null,
            args.variantId,
            args.quantity ?? 1,
          );
        } catch (e) {
          return safeError(e);
        }
      },

      updateCartItem: async (_: unknown, args: any, ctx) => {
        try {
          return await updateCartItem(
            ctx.user?.id ?? null,
            ctx.anonymousToken ?? null,
            args.itemId,
            args.quantity,
          );
        } catch (e) {
          return safeError(e);
        }
      },

      removeCartItem: async (_: unknown, args: any, ctx) => {
        try {
          return await removeCartItem(
            ctx.user?.id ?? null,
            ctx.anonymousToken ?? null,
            args.itemId,
          );
        } catch (e) {
          return safeError(e);
        }
      },

      saveAdminProduct: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);
          return await saveAdminProduct(args);
        } catch (e) {
          return safeError(e);
        }
      },

      deleteAdminProduct: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);
          return await deleteAdminProduct(args.id);
        } catch (e) {
          return safeError(e);
        }
      },

      saveAdminVariant: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);
          return await saveVariant(args);
        } catch (e) {
          return safeError(e);
        }
      },

      deleteAdminVariant: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);
          return await deleteVariant(args.id);
        } catch (e) {
          return safeError(e);
        }
      },

      uploadProductImage: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);

          return await uploadProductImage(args);
        } catch (e) {
          return safeError(e);
        }
      },

      deleteProductImage: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);

          return await deleteProductImage(args.id);
        } catch (e) {
          return safeError(e);
        }
      },

      setPrimaryProductImage: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);

          return await setPrimaryProductImage(args.id);
        } catch (e) {
          return safeError(e);
        }
      },

      reorderProductImages: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);

          return await reorderProductImages(args.productId, args.imageIds);
        } catch (e) {
          return safeError(e);
        }
      },

      createPaymentOrder: async (_: unknown, args: any, ctx) => {
        try {
          const u = requireUser(ctx.user);

          return await createPaymentOrder(u.id, args);
        } catch (e) {
          return safeError(e);
        }
      },

      verifyPayment: async (_: unknown, args: any, ctx) => {
        try {
          const u = requireUser(ctx.user);

          const r = await verifyPayment(
            u.id,
            args.orderId,
            args.razorpayOrderId,
            args.razorpayPaymentId,
            args.razorpaySignature,
          );

          return await getCustomerOrder(u.id, r.orderId);
        } catch (e) {
          return safeError(e);
        }
      },

      cancelMyOrder: async (_: unknown, args: any, ctx) => {
        try {
          const u = requireUser(ctx.user);

          return await cancelCustomerOrder(u.id, args.id, args.reason);
        } catch (e) {
          return safeError(e);
        }
      },

      requestReturn: async (_: unknown, args: any, ctx) => {
        try {
          const u = requireUser(ctx.user);

          await requestReturn(u.id, args.orderId, args.reason);

          return true;
        } catch (e) {
          return safeError(e);
        }
      },

      requestItemAfterSales: async (_: unknown, args: any, ctx) => {
        try {
          const u = requireUser(ctx.user);

          return await requestItemAfterSales(
            u.id,
            args.orderId,
            args.orderItemId,
            args.requestType,
            args.reason,
            args.requestedSize,
          );
        } catch (e) {
          return safeError(e);
        }
      },

      saveAddress: async (_: unknown, args: any, ctx) => {
        try {
          const u = requireUser(ctx.user);

          return await saveAddress(u.id, args);
        } catch (e) {
          return safeError(e);
        }
      },

      deleteAddress: async (_: unknown, args: any, ctx) => {
        try {
          const u = requireUser(ctx.user);

          return await deleteAddress(u.id, args.id);
        } catch (e) {
          return safeError(e);
        }
      },

      updateAdminOrder: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);

          return await updateAdminOrder(args);
        } catch (e) {
          return safeError(e);
        }
      },

      refundOrder: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);

          await adminRefundOrder(args.id, args.amountInr, args.reason);

          return await getAdminOrder(args.id);
        } catch (e) {
          return safeError(e);
        }
      },

      saveCategory: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);

          return await saveCategory(args);
        } catch (e) {
          return safeError(e);
        }
      },

      deleteCategory: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);

          return await deleteCategory(args.id);
        } catch (e) {
          return safeError(e);
        }
      },

      saveCoupon: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);

          return await saveCoupon(args);
        } catch (e) {
          return safeError(e);
        }
      },

      deleteCoupon: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);

          return await deleteCoupon(args.id);
        } catch (e) {
          return safeError(e);
        }
      },

      updateReturnRequest: async (_: unknown, args: any, ctx) => {
        try {
          requireAdmin(ctx.user);

          return await updateReturnRequest(
            args.id,
            args.status,
            args.adminNote,
          );
        } catch (e) {
          return safeError(e);
        }
      },

      addToWishlist: async (_: unknown, args: any, ctx) => {
        try {
          const u = requireUser(ctx.user);

          return await addToWishlist(u.id, args.productId);
        } catch (e) {
          return safeError(e);
        }
      },

      removeFromWishlist: async (_: unknown, args: any, ctx) => {
        try {
          const u = requireUser(ctx.user);

          return await removeFromWishlist(u.id, args.productId);
        } catch (e) {
          return safeError(e);
        }
      },
    },

    Product: {
      images: (p: any) => p.images ?? [],

      variants: async (p: any) => {
        const full = await getProductById(p.id);

        return full?.variants ?? [];
      },
    },

    AdminProduct: {
      images: (p: any) => p.images ?? [],

      variants: (p: any) => p.variants ?? [],
    },
  },
});

async function getProductById(id: string) {
  const { getDb } = await import("../db.js");

  const pool = await getDb();

  const r = await pool
    .request()
    .input("id", id)
    .query<any>(
      `
        SELECT
          v.id,
          v.size,
          v.color,
          CAST(
            i.quantity_available - i.quantity_reserved
            AS int
          ) stock
        FROM product_variants v
        INNER JOIN inventory i
          ON i.variant_id = v.id
        WHERE v.product_id = @id
        ORDER BY v.created_at
      `,
    );

  return {
    variants: r.recordset,
  };
}

export async function processRazorpayWebhook(
  rawBody: string | Buffer,
  signature: string,
  eventId: string | undefined,
  payload: any,
) {
  return handleRazorpayWebhook(rawBody, signature, eventId, payload);
}
