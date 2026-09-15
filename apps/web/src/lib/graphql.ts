import { GraphQLClient, gql } from 'graphql-request';

export const graphqlUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL ?? 'http://localhost:4000/graphql';

export function apiClient(headers?: HeadersInit) {
  return new GraphQLClient(graphqlUrl, {
    credentials: 'include',
    headers
  });
}

export const graphqlClient = apiClient();

export async function apiRequest<T>(query: string, variables?: Record<string, unknown>, headers?: HeadersInit) {
  return apiClient(headers).request<T>(query, variables);
}

export const productsQuery = gql`
  query Products($limit: Int, $categorySlug: String, $search: String) {
    products(limit: $limit, categorySlug: $categorySlug, search: $search) {
      id slug name description priceInr compareAtPriceInr imageUrl categorySlug
    }
  }
`;

export const productQuery = gql`
  query Product($slug: String!) {
    product(slug: $slug) {
      id slug name description priceInr compareAtPriceInr imageUrl images { id url altText sortOrder isPrimary } categorySlug sku sizes colors stock
      variants { id size color stock }
    }
  }
`;

export const categoriesQuery = gql`
  query Categories { categories { id slug name } }
`;

export const meQuery = gql`
  query Me { me { id email firstName lastName role } }
`;

export const loginMutation = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      user { id email firstName lastName role }
      cart { count subtotalInr items { id variantId slug name size color priceInr quantity imageUrl totalInr } }
    }
  }
`;

export const registerMutation = gql`
  mutation Register($email: String!, $password: String!, $firstName: String, $lastName: String) {
    register(email: $email, password: $password, firstName: $firstName, lastName: $lastName) {
      user { id email firstName lastName role }
      cart { count subtotalInr items { id variantId slug name size color priceInr quantity imageUrl totalInr } }
    }
  }
`;

export const logoutMutation = gql`mutation Logout { logout }`;

export const cartQuery = gql`
  query Cart {
    cart {
      id count subtotalInr
      items { id variantId slug name size color priceInr quantity imageUrl totalInr }
    }
  }
`;

export const addToCartMutation = gql`
  mutation AddToCart($variantId: ID!, $quantity: Int) {
    addToCart(variantId: $variantId, quantity: $quantity) {
      id count subtotalInr
      items { id variantId slug name size color priceInr quantity imageUrl totalInr }
    }
  }
`;

export const updateCartItemMutation = gql`
  mutation UpdateCartItem($itemId: ID!, $quantity: Int!) {
    updateCartItem(itemId: $itemId, quantity: $quantity) {
      id count subtotalInr
      items { id variantId slug name size color priceInr quantity imageUrl totalInr }
    }
  }
`;

export const removeCartItemMutation = gql`
  mutation RemoveCartItem($itemId: ID!) {
    removeCartItem(itemId: $itemId) {
      id count subtotalInr
      items { id variantId slug name size color priceInr quantity imageUrl totalInr }
    }
  }
`;
