"use client";

import { ShoppingCart, Package, Users, BarChart } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductsGrid } from "./products-grid";
import { TerminalTutorial } from "./terminal-tutorial";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [showProducts, setShowProducts] = useState(false);
  const router = useRouter();

  const handleTutorialComplete = () => {
    router.push("/products");
  };

  return (
    <div className="h-full space-y-6">
      {!showProducts ? (
        <TerminalTutorial onComplete={handleTutorialComplete} />
      ) : (
        <ProductsGrid />
      )}
    </div>
  );
}
