import ProductEditor from '../ProductEditor';
export default async function EditProductPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ProductEditor id={id}/>;}
