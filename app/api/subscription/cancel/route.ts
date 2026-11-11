/**
 * Subscription Cancellation API Route
 *
 * Handles subscription cancellation requests using the Creem SDK.
 * Requires authentication and valid subscription ID.
 *
 * @module api/subscription/cancel
 */

import { NextRequest, NextResponse } from "next/server";
import { Creem } from "creem";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Initialize Creem SDK client
 * Server index 1 is used for test environment
 */
const creem = new Creem({
  serverIdx: 1,
});

/**
 * POST /api/subscription/cancel
 *
 * Cancels an active subscription for the authenticated user.
 * The subscription will remain active until the end of the current billing period.
 *
 * @async
 * @function
 * @param {NextRequest} req - Next.js request object containing:
 *   - subscription_id: Query parameter for the subscription to cancel
 *
 * @returns {Promise<NextResponse>}
 * - Success: Empty response with 200 status
 * - Error: JSON response with error message and appropriate status code
 *
 * @example
 * // Request
 * POST /api/subscription/cancel?subscription_id=sub_123
 *
 * // Success Response
 * Status: 200 OK
 *
 * // Error Response
 * {
 *   "error": "Unauthorized"
 * }
 * Status: 401 Unauthorized
 */
export async function POST(req: NextRequest) {
  // Get authenticated session and subscription ID
  const session = await auth.api.getSession({ headers: headers() });
  const subscriptionId = req.nextUrl.searchParams.get("subscription_id");
  const apiKey = process.env.CREEM_API_KEY;

  // Verify authentication and subscription ID
  if (!subscriptionId || !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Call Creem SDK to cancel the subscription
    // This will prevent renewal at the end of the current period
    await creem.cancelSubscription({
      xApiKey: apiKey as string,
      id: subscriptionId as string,
    });

    // Return empty response on success
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 },
    );
  }
}
