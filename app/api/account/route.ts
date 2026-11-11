/**
 * Account API Route
 *
 * This route provides access to a user's purchase history, including both subscriptions
 * and one-time purchases. It requires authentication and uses raw SQL queries through
 * Prisma for efficient data retrieval.
 *
 * @route GET /api/account
 */

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const prisma = new PrismaClient();

/**
 * Response interface for user purchases endpoint
 * Contains arrays of both subscription and one-time purchase records
 */
export interface UserPurchasesResponse {
  subscriptions: {
    id: string; // Unique identifier for the subscription
    product: string; // Product identifier or name
    providerCustomerId: string; // Customer ID from the payment provider
    status: string; // Current subscription status
    created_at: Date; // Subscription creation timestamp
    updated_at: Date; // Last update timestamp
  }[];
  oneTimePurchases: {
    id: string; // Unique identifier for the purchase
    product: string; // Product identifier or name
    providerCustomerId: string; // Customer ID from the payment provider
    created_at: Date; // Purchase timestamp
    updated_at: Date; // Last update timestamp
  }[];
}

/**
 * GET handler for retrieving user's purchase history
 *
 * @returns {Promise<NextResponse>} JSON response containing:
 *   - On success: UserPurchasesResponse with subscriptions and one-time purchases
 *   - On error: 401 Unauthorized if no valid session
 *
 * Example successful response:
 * {
 *   "subscriptions": [{
 *     "id": "sub_123",
 *     "product": "premium_plan",
 *     "providerCustomerId": "cus_456",
 *     "status": "active",
 *     "created_at": "2024-01-01T00:00:00Z",
 *     "updated_at": "2024-01-01T00:00:00Z"
 *   }],
 *   "oneTimePurchases": [{
 *     "id": "pur_789",
 *     "product": "single_item",
 *     "providerCustomerId": "cus_456",
 *     "created_at": "2024-01-01T00:00:00Z",
 *     "updated_at": "2024-01-01T00:00:00Z"
 *   }]
 * }
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: headers() });

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch both subscriptions and one-time purchases concurrently using raw SQL
  // This approach provides better performance for large datasets compared to Prisma's
  // standard query builder but mostly used to demonstrate the use of raw SQL queries
  // and have different examples in this template
  const [subscriptions, oneTimePurchases] = await Promise.all([
    prisma.$queryRaw`
      SELECT id, product, providerCustomerId, status, created_at, updated_at
      FROM subscription
      WHERE userId = ${session.user.id}
      ORDER BY created_at DESC
    `,
    prisma.$queryRaw`
      SELECT id, product, providerCustomerId, created_at, updated_at
      FROM onetimepurchase
      WHERE userId = ${session.user.id}
      ORDER BY created_at DESC
    `,
  ]);

  return NextResponse.json({
    subscriptions,
    oneTimePurchases,
  } as UserPurchasesResponse);
}
