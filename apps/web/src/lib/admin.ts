import { gql } from 'graphql-request';

const adminFields = `
  id slug name description priceInr compareAtPriceInr sku isActive categoryId categorySlug categoryName imageUrl stock
  images { id url storageKey altText sortOrder isPrimary }
  variants { id sku size color stock }
`;

export const adminProductsQuery = gql`query AdminProducts($search:String,$active:Boolean){ adminProducts(search:$search,active:$active){ ${adminFields} } }`;
export const adminProductQuery = gql`query AdminProduct($id:ID!){ adminProduct(id:$id){ ${adminFields} } }`;
export const adminSaveProductMutation = gql`mutation SaveAdminProduct($id:ID,$name:String!,$slug:String!,$description:String,$priceInr:Int!,$compareAtPriceInr:Int,$sku:String!,$categoryId:ID!,$isActive:Boolean!){ saveAdminProduct(id:$id,name:$name,slug:$slug,description:$description,priceInr:$priceInr,compareAtPriceInr:$compareAtPriceInr,sku:$sku,categoryId:$categoryId,isActive:$isActive){ ${adminFields} } }`;
export const adminDeleteProductMutation = gql`mutation DeleteAdminProduct($id:ID!){ deleteAdminProduct(id:$id) }`;
export const adminSaveVariantMutation = gql`mutation SaveAdminVariant($id:ID,$productId:ID!,$sku:String!,$size:String!,$color:String!,$stock:Int!){ saveAdminVariant(id:$id,productId:$productId,sku:$sku,size:$size,color:$color,stock:$stock){ ${adminFields} } }`;
export const adminDeleteVariantMutation = gql`mutation DeleteAdminVariant($id:ID!){ deleteAdminVariant(id:$id){ ${adminFields} } }`;
export const adminUploadImageMutation = gql`mutation UploadProductImage($productId:ID!,$filename:String!,$contentType:String!,$dataBase64:String!,$altText:String){ uploadProductImage(productId:$productId,filename:$filename,contentType:$contentType,dataBase64:$dataBase64,altText:$altText){ ${adminFields} } }`;
export const adminDeleteImageMutation = gql`mutation DeleteProductImage($id:ID!){ deleteProductImage(id:$id){ ${adminFields} } }`;
export const adminPrimaryImageMutation = gql`mutation PrimaryProductImage($id:ID!){ setPrimaryProductImage(id:$id){ ${adminFields} } }`;
export const adminReorderImagesMutation = gql`mutation ReorderProductImages($productId:ID!,$imageIds:[ID!]!){ reorderProductImages(productId:$productId,imageIds:$imageIds){ ${adminFields} } }`;
