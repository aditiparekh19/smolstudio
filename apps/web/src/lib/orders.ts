import { gql } from "graphql-request";

const orderFields = `
  id
  orderNumber
  status
  paymentStatus
  currency
  subtotalInr
  shippingInr
  discountInr
  taxInr
  totalInr
  trackingNumber
  carrier
  trackingUrl
  createdAt
  shippedAt
  deliveredAt
  shippingAddress {
    recipientName
    line1
    line2
    city
    state
    postalCode
    countryCode
    phone
  }
  items {
  id
  productName
  sku
  quantity
  unitPriceInr
  totalPriceInr
  productId
  variantId
  size
  replacementSizes
}
`;

export const checkoutTotalsQuery = gql`
  query CheckoutTotals($couponCode: String) {
    checkoutTotals(couponCode: $couponCode) {
      subtotalInr
      shippingInr
      discountInr
      taxInr
      totalInr
      storeCreditAppliedInr
      payableInr
      couponCode
    }
  }
`;

export const createPaymentOrderMutation = gql`
  mutation CreatePaymentOrder(
    $recipientName: String!
    $line1: String!
    $line2: String
    $city: String!
    $state: String!
    $postalCode: String!
    $countryCode: String
    $phone: String
    $couponCode: String
  ) {
    createPaymentOrder(
      recipientName: $recipientName
      line1: $line1
      line2: $line2
      city: $city
      state: $state
      postalCode: $postalCode
      countryCode: $countryCode
      phone: $phone
      couponCode: $couponCode
    ) {
      orderId
      orderNumber
      amount
      currency
      razorpayOrderId
      keyId
      subtotalInr
      shippingInr
      discountInr
      taxInr
      totalInr
      storeCreditAppliedInr
      payableInr
      couponCode
    }
  }
`;

export const verifyPaymentMutation = gql`
  mutation VerifyPayment(
    $orderId: ID!
    $razorpayOrderId: String!
    $razorpayPaymentId: String!
    $razorpaySignature: String!
  ) {
    verifyPayment(
      orderId: $orderId
      razorpayOrderId: $razorpayOrderId
      razorpayPaymentId: $razorpayPaymentId
      razorpaySignature: $razorpaySignature
    ) {
      ${orderFields}
    }
  }
`;

export const myOrdersQuery = gql`
  query MyOrders {
    myOrders {
      ${orderFields}
    }
  }
`;

export const myOrderQuery = gql`
  query MyOrder($id: ID!) {
    myOrder(id: $id) {
      ${orderFields}
    }
  }
`;

export const cancelMyOrderMutation = gql`
  mutation CancelMyOrder($id: ID!, $reason: String!) {
    cancelMyOrder(id: $id, reason: $reason) {
      ${orderFields}
    }
  }
`;

/*
 * Legacy whole-order return mutation.
 * Kept so the existing backend functionality is not removed.
 */
export const requestReturnMutation = gql`
  mutation RequestReturn($orderId: ID!, $reason: String!) {
    requestReturn(orderId: $orderId, reason: $reason)
  }
`;

/*
 * New item-level after-sales request.
 *
 * PRODUCT_FAULT:
 * Customer reports a fault/damage/problem.
 *
 * SIZE_REPLACEMENT:
 * Customer requests another size of the same product.
 */
export const requestItemAfterSalesMutation = gql`
  mutation RequestItemAfterSales(
    $orderId: ID!
    $orderItemId: ID!
    $requestType: String!
    $reason: String!
    $requestedSize: String
    $images: [AfterSalesImageInput!]
  ) {
    requestItemAfterSales(
      orderId: $orderId
      orderItemId: $orderItemId
      requestType: $requestType
      reason: $reason
      requestedSize: $requestedSize
      images: $images
    ) {
      id
      orderId
      orderItemId
      requestType
      requestedSize
      calculatedPaidAmountInr
      status
    }
  }
`;

export const myAddressesQuery = gql`
  query MyAddresses {
    myAddresses {
      id
      label
      recipientName
      line1
      line2
      city
      state
      postalCode
      countryCode
      phone
    }
  }
`;

export const saveAddressMutation = gql`
  mutation SaveAddress(
    $id: ID
    $label: String
    $recipientName: String!
    $line1: String!
    $line2: String
    $city: String!
    $state: String!
    $postalCode: String!
    $countryCode: String
    $phone: String
  ) {
    saveAddress(
      id: $id
      label: $label
      recipientName: $recipientName
      line1: $line1
      line2: $line2
      city: $city
      state: $state
      postalCode: $postalCode
      countryCode: $countryCode
      phone: $phone
    ) {
      id
      label
      recipientName
      line1
      line2
      city
      state
      postalCode
      countryCode
      phone
    }
  }
`;

export const deleteAddressMutation = gql`
  mutation DeleteAddress($id: ID!) {
    deleteAddress(id: $id) {
      id
      label
      recipientName
      line1
      line2
      city
      state
      postalCode
      countryCode
      phone
    }
  }
`;

export const myReturnsQuery = gql`
  query MyReturns {
    myReturns {
      id
      orderId
      orderNumber
      customerId
      customerEmail
      orderItemId
      requestType
      requestedSize
      reason
      status
      refundAmountInr
      approvedCreditInr
      replacementVariantId
      replacementOrderId
      adminNote
      adminReviewedAt
      adminReviewedBy
      processingAt
      pickedUpAt
      receivedAt
      reviewedAt
      completedAt
      pickupTrackingNumber
      replacementFulfilledAt
      createdAt
      updatedAt
    }
  }
`;

const adminOrderFields = `
  id
  orderNumber
  status
  paymentStatus
  paymentProvider
  paymentReference
  paymentOrderId
  subtotalInr
  shippingInr
  discountInr
  taxInr
  totalInr
  currency
  trackingNumber
  carrier
  trackingUrl
  createdAt
  updatedAt
  shippedAt
  deliveredAt
  cancelledAt
  cancelReason
  couponCode
  customerId
  customerEmail
  firstName
  lastName
  customerPhone
  shippingAddress {
    recipientName
    line1
    line2
    city
    state
    postalCode
    countryCode
    phone
  }
  items {
    id
    productName
    sku
    quantity
    unitPriceInr
    totalPriceInr
  }
  history {
    status
    note
    createdAt
  }
  refunds {
    id
    refundId
    amountInr
    status
    reason
    createdAt
  }
`;

export const adminOrdersQuery = gql`
  query AdminOrders($search: String, $status: String) {
    adminOrders(search: $search, status: $status) {
      ${adminOrderFields}
    }
  }
`;

export const adminOrderQuery = gql`
  query AdminOrder($id: ID!) {
    adminOrder(id: $id) {
      ${adminOrderFields}
    }
  }
`;

export const adminUpdateOrderMutation = gql`
  mutation UpdateAdminOrder(
    $id: ID!
    $status: String!
    $trackingNumber: String
    $carrier: String
    $trackingUrl: String
    $note: String
  ) {
    updateAdminOrder(
      id: $id
      status: $status
      trackingNumber: $trackingNumber
      carrier: $carrier
      trackingUrl: $trackingUrl
      note: $note
    ) {
      ${adminOrderFields}
    }
  }
`;

export const adminRefundMutation = gql`
  mutation RefundOrder(
    $id: ID!
    $amountInr: Int!
    $reason: String!
  ) {
    refundOrder(
      id: $id
      amountInr: $amountInr
      reason: $reason
    ) {
      ${adminOrderFields}
    }
  }
`;

export const adminCustomersQuery = gql`
  query AdminCustomers($search: String) {
    adminCustomers(search: $search) {
      id
      email
      phone
      firstName
      lastName
      role
      createdAt
      orderCount
      totalSpentInr
      returnCount
      addresses {
        id
        label
        recipientName
        line1
        line2
        city
        state
        postalCode
        countryCode
        phone
      }
    }
  }
`;

export const adminCustomerQuery = gql`
  query AdminCustomer($id: ID!) {
    adminCustomer(id: $id) {
      id
      email
      phone
      firstName
      lastName
      role
      createdAt
      addresses {
        id
        label
        recipientName
        line1
        line2
        city
        state
        postalCode
        countryCode
        phone
      }
      orders {
        id
        orderNumber
        status
        paymentStatus
        totalInr
        createdAt
      }
    }
  }
`;

export const adminStatsQuery = gql`
  query AdminStats {
    adminStats {
      productCount
      activeProductCount
      customerCount
      orderCount
      pendingOrderCount
      revenueInr
      returnRequestCount
      outOfStockCount
    }
  }
`;

export const adminCashFlowQuery = gql`
  query AdminCashFlow {
    adminCashFlow {
      incomeInr
      refundInr
      storeCreditInr
      netCashFlowInr
    }
  }
`;

export const adminCategoriesQuery = gql`
  query AdminCategories {
    adminCategories {
      id
      slug
      name
      sortOrder
      isActive
    }
  }
`;

export const saveCategoryMutation = gql`
  mutation SaveCategory(
    $id: ID
    $name: String!
    $slug: String
    $sortOrder: Int
    $isActive: Boolean
  ) {
    saveCategory(
      id: $id
      name: $name
      slug: $slug
      sortOrder: $sortOrder
      isActive: $isActive
    ) {
      id
      slug
      name
      sortOrder
      isActive
    }
  }
`;

export const deleteCategoryMutation = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;

export const adminCouponsQuery = gql`
  query AdminCoupons {
    adminCoupons {
      id
      code
      discountType
      discountValue
      minOrderInr
      maxDiscountInr
      maxRedemptions
      redeemedCount
      startsAt
      endsAt
      isActive
    }
  }
`;

export const saveCouponMutation = gql`
  mutation SaveCoupon(
    $id: ID
    $code: String!
    $discountType: String!
    $discountValue: Float!
    $minOrderInr: Float
    $maxDiscountInr: Float
    $maxRedemptions: Int
    $startsAt: String!
    $endsAt: String
    $isActive: Boolean
  ) {
    saveCoupon(
      id: $id
      code: $code
      discountType: $discountType
      discountValue: $discountValue
      minOrderInr: $minOrderInr
      maxDiscountInr: $maxDiscountInr
      maxRedemptions: $maxRedemptions
      startsAt: $startsAt
      endsAt: $endsAt
      isActive: $isActive
    ) {
      id
      code
      discountType
      discountValue
      minOrderInr
      maxDiscountInr
      maxRedemptions
      redeemedCount
      startsAt
      endsAt
      isActive
    }
  }
`;

export const deleteCouponMutation = gql`
  mutation DeleteCoupon($id: ID!) {
    deleteCoupon(id: $id)
  }
`;

export const adminReturnsQuery = gql`
  query AdminReturns($status: String) {
    adminReturns(status: $status) {
      id
      orderId
      orderNumber
      customerId
      customerEmail
      orderItemId
      requestType
      requestedSize
      reason
      status
      refundAmountInr
      approvedCreditInr
      replacementVariantId
      replacementOrderId
      adminNote
      adminReviewedAt
      adminReviewedBy
      replacementFulfilledAt
      images {
        id
        filename
        contentType
        url
      }
      createdAt
      updatedAt
      processingAt
      pickedUpAt
      receivedAt
      reviewedAt
      completedAt
      pickupTrackingNumber
    }
  }
`;

export const updateReturnRequestMutation = gql`
  mutation UpdateReturn(
    $id: ID!
    $status: String!
    $adminNote: String
    $pickupTrackingNumber: String
  ) {
    updateReturnRequest(
      id: $id
      status: $status
      adminNote: $adminNote
      pickupTrackingNumber: $pickupTrackingNumber
    )
  }
`;

export const myStoreCreditQuery = gql`
  query MyStoreCredit {
    myStoreCredit {
      balanceInr
      reservedInr
      availableInr
      transactions {
        id
        type
        amountInr
        balanceAfterInr
        orderId
        description
        createdAt
      }
    }
  }
`;

export const adminCashFlowHistoryQuery = gql`
  query AdminCashFlowHistory {
    adminCashFlowHistory {
      date
      incomeInr
      refundInr
      storeCreditInr
      netCashFlowInr
    }
  }
`;
