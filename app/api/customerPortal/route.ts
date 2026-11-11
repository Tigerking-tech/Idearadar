/**
 * Customer Portal API Route
 *
 * Generates a secure link to the customer portal using the Creem SDK.
 * The portal allows customers to manage their subscriptions and billing information.
 *
 * @module api/customerPortal
 */

import { Creem } from "creem";
import { NextRequest, NextResponse } from "next/server";

/**
 * Initialize Creem SDK client
 * Server index 1 is used for test environment
 */
const creem = new Creem({
  serverIdx: 1,
});

/**
 * GET /api/customerPortal
 *
 * Generates a unique URL for accessing the customer portal.
 * Requires a valid customer ID to generate the portal link.
 *
 * @async
 * @function
 * @param {NextRequest} req - Next.js request object containing:
 *   - customer_id: Query parameter identifying the customer
 *
 * @returns {Promise<NextResponse>} JSON response containing:
 * - Success: { url: string } - Portal access URL
 * - Error: { error: string } with appropriate status code
 *
 * @example
 * // Request
 * GET /api/customerPortal?customer_id=cus_123
 *
 * // Success Response
 * {
 *   "url": "https://portal.creem.io/cp_123..."
 * }
 *
 * // Error Response
 * {
 *   "error": "Unauthorized"
 * }
 * Status: 401 Unauthorized
 */
export async function GET(req: NextRequest) {
  const apiKey = process.env.CREEM_API_KEY;
  const customerId = req.nextUrl.searchParams.get("customer_id");

  // Verify customer ID is provided
  if (!customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Generate customer portal link using Creem SDK
    const customerPortalLogin = await creem.generateCustomerLinks({
      xApiKey: apiKey as string,
      createCustomerPortalLinkRequestEntity: {
        customerId: customerId,
      },
    });

    // Return the portal URL for client-side redirect
    return NextResponse.json({ url: customerPortalLogin.customerPortalLink });
  } catch (error) {
    console.error("Error generating customer portal link:", error);
    return NextResponse.json(
      { error: "Failed to generate portal link" },
      { status: 500 },
    );
  }
}
