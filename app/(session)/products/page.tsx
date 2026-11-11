import { ProductsGrid } from "../dashboard/products-grid";

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-mono text-neutral-200">Products</h1>
      <ProductsGrid />
    </div>
  );
} 