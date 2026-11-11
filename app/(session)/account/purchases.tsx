"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { UserPurchasesResponse } from "@/app/api/account/route";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function Purchases() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<UserPurchasesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCustomerPortal = async (customerId: string) => {
    try {
      const response = await fetch(`/api/customerPortal?customer_id=${encodeURIComponent(customerId)}`);
      if (!response.ok) throw new Error("Failed to get portal URL");
      const data = await response.json();
      window.location.href = data.url;
    } catch (err) {
      console.error("Error accessing customer portal:", err);
    }
  };

  const fetchPurchases = async () => {
    try {
      const response = await fetch("/api/account");
      if (!response.ok) {
        throw new Error("Failed to fetch purchases");
      }
      const data = await response.json();
      setPurchases(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    try {
      setIsCancelling(true);
      const response = await fetch(`/api/subscription/cancel?subscription_id=${encodeURIComponent(subscriptionId)}`, {
        method: "POST",
      });
      
      if (!response.ok) throw new Error("Failed to cancel subscription");
      
      // Wait for 2 seconds before refreshing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Refresh the purchases data
      await fetchPurchases();
    } catch (err) {
      console.error("Error cancelling subscription:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-4 bg-neutral-800 rounded w-3/4 mb-4" />
            <div className="h-3 bg-neutral-800 rounded w-1/2" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-red-500">{error}</p>
      </Card>
    );
  }

  if (!purchases || (!purchases.subscriptions.length && !purchases.oneTimePurchases.length)) {
    return (
      <Card className="p-6">
        <p className="text-neutral-500">No purchases found.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {purchases.subscriptions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-mono text-neutral-200">Subscriptions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {purchases.subscriptions.map((subscription) => (
              <motion.div
                key={subscription.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-6 space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-mono text-neutral-200">{subscription.product}</h3>
                    <Badge 
                      variant={
                        subscription.status === "active" ? "default" :
                        subscription.status === "canceled" ? "outline" :
                        subscription.status === "expired" ? "secondary" :
                        "secondary"
                      }
                      className={
                        subscription.status === "canceled" ? "text-neutral-400 border-neutral-400" :
                        subscription.status === "expired" ? "bg-neutral-800 text-neutral-400" :
                        ""
                      }
                    >
                      {subscription.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-neutral-500 space-y-1">
                    <p>Customer ID: {subscription.providerCustomerId}</p>
                    <p>Started: {new Date(subscription.created_at).toLocaleDateString()}</p>
                    <p>Last updated: {new Date(subscription.updated_at).toLocaleDateString()}</p>
                  </div>
                  <div className="space-x-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCustomerPortal(subscription.providerCustomerId)}
                      className="hover:bg-neutral-900/50"
                    >
                      Customer Portal
                    </Button>
                    {subscription.status === "active" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelSubscription(subscription.id)}
                        disabled={isCancelling}
                        className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
                      >
                        {isCancelling ? "Cancelling..." : "Cancel"}
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {purchases.oneTimePurchases.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-mono text-neutral-200">One-time Purchases</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {purchases.oneTimePurchases.map((purchase) => (
              <motion.div
                key={purchase.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-6 space-y-4">
                  <h3 className="font-mono text-neutral-200">{purchase.product}</h3>
                  <div className="text-sm text-neutral-500 space-y-1">
                    <p>Customer ID: {purchase.providerCustomerId}</p>
                    <p>Purchased: {new Date(purchase.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCustomerPortal(purchase.providerCustomerId)}
                      className="hover:bg-neutral-900/50"
                    >
                      Customer Portal
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 