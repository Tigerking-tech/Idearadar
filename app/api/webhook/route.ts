/**
 * Webhook API Route
 * 
 * Handles incoming webhooks from Creem's payment system.
 * Processes both one-time payments and subscription lifecycle events.
 * Updates local database to maintain payment and subscription state.
 * 
 * @module api/webhook
 */

import { NextResponse, NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Webhook Response Interface
 * 
 * Represents the structure of incoming webhook events from Creem.
 * This is a simplified version focusing on essential fields for the template.
 * 
 * @interface WebhookResponse
 * @property {string} id - Unique identifier for the webhook event
 * @property {string} eventType - Type of event (e.g., "checkout.completed", "subscription.paid")
 * @property {Object} object - Contains the event payload
 * @property {string} object.request_id - Contains userId for one-time payments
 * @property {string} object.id - Unique identifier for the payment/subscription
 * @property {Object} object.customer - Customer information
 * @property {Object} object.product - Product information including billing type
 * @property {string} object.status - Current status of the payment/subscription
 * @property {Object} object.metadata - Additional data passed during checkout
 */
export interface WebhookResponse {
  id: string;
  eventType: string;
  object: {
    request_id: string;
    object: string;
    id: string;
    customer: {
      id: string;
    };
    product: {
      id: string;
      billing_type: string;
    };
    status: string;
    metadata: any;
  };
}

/**
 * POST /api/webhook
 * 
 * Processes incoming webhook events from Creem's payment system.
 * Handles both one-time payments and subscription lifecycle events.
 * 
 * Event Types Handled:
 * 1. One-Time Payments:
 *    - checkout.completed: Payment successful, fulfill purchase
 * 
 * 2. Subscriptions:
 *    - subscription.paid: New subscription or successful renewal
 *    - subscription.canceled: Subscription cancellation requested
 *    - subscription.expired: Subscription ended (payment failed or period ended)
 * 
 * @async
 * @function
 * @param {NextRequest} req - Incoming webhook request containing event data
 * @returns {Promise<NextResponse>} Confirmation of webhook processing
 * 
 * @example Webhook Event - One-Time Payment
 * {
 *   "id": "whk_123",
 *   "eventType": "checkout.completed",
 *   "object": {
 *     "request_id": "user_123",
 *     "id": "pay_123",
 *     "customer": { "id": "cus_123" },
 *     "product": {
 *       "id": "prod_123",
 *       "billing_type": "one-time"
 *     }
 *   }
 * }
 * 
 * @example Webhook Event - Subscription
 * {
 *   "id": "whk_456",
 *   "eventType": "subscription.paid",
 *   "object": {
 *     "id": "sub_123",
 *     "metadata": { "userId": "user_123" },
 *     "customer": { "id": "cus_123" },
 *     "product": {
 *       "id": "prod_456",
 *       "billing_type": "recurring"
 *     }
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  const webhook = (await req.json()) as WebhookResponse;

  // Determine payment type based on billing_type
  const isSubscription = webhook.object.product.billing_type === "recurring";

  if (!isSubscription) {
    /**
     * One-Time Payment Flow
     * --------------------
     * 1. Verify payment completion via checkout.completed event
     * 2. Extract user ID from request_id (set during checkout)
     * 3. Store purchase record in database
     * 4. Enable access to purchased product/feature
     */
    if (webhook.eventType === "checkout.completed") {
      const userId = webhook.object.request_id;
      const productId = webhook.object.product.id;
      const providerCustomerId = webhook.object.customer.id;
      
      // Create purchase record in database
      await prisma.oneTimePurchase.create({
        data: {
          id: webhook.object.id,
          userId,
          product: productId,
          providerCustomerId,
        },
      });
    }
  } else {
    /**
     * Subscription Flow
     * ----------------
     * Handles the complete subscription lifecycle:
     * 
     * 1. subscription.paid
     *    - New subscription or successful renewal
     *    - Create/update subscription record
     *    - Enable access to subscription features
     * 
     * 2. subscription.canceled
     *    - User requested cancellation
     *    - Mark subscription for non-renewal
     *    - Optionally maintain access until period end
     * 
     * 3. subscription.expired
     *    - Final state: payment failed or canceled period ended
     *    - Update subscription status
     *    - Revoke access to subscription features
     */
    if (webhook.eventType === "subscription.paid") {
      const userId = webhook.object.metadata.userId;
      const productId = webhook.object.product.id;
      const providerCustomerId = webhook.object.customer.id;

      // Upsert subscription to handle both new and renewal payments
      await prisma.subscription.upsert({
        where: { id: webhook.object.id },
        update: { status: "active" },
        create: {
          id: webhook.object.id,
          userId,
          product: productId,
          status: "active",
          providerCustomerId,
        },
      });
    }

    if (webhook.eventType === "subscription.canceled") {
      // Update subscription status to handle cancellation
      await prisma.subscription.update({
        where: { id: webhook.object.id },
        data: {
          status: "canceled",
          updated_at: new Date(Date.now()),
        },
      });
    }

    if (webhook.eventType === "subscription.expired") {
      // Final subscription state update
      await prisma.subscription.update({
        where: { id: webhook.object.id },
        data: {
          status: "expired",
          updated_at: new Date(Date.now()),
        },
      });
    }
  }

  // Confirm webhook processing
  return NextResponse.json({
    success: true,
    message: "Webhook received successfully",
  });
}
