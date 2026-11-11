/**
 * Authentication Catch-All Route
 * 
 * This route handles all authentication-related requests using Better Auth.
 * It provides endpoints for user authentication, session management, and OAuth flows.
 * 
 * The catch-all route ([...all]) matches any path under /api/auth/, allowing Better Auth
 * to handle various authentication paths like:
 * - /api/auth/login
 * - /api/auth/register
 * - /api/auth/logout
 * - /api/auth/session
 * - /api/auth/oauth/callback
 * 
 * @module api/auth/[...all]
 */

import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Export POST and GET handlers for authentication endpoints
 * These handlers are automatically configured by Better Auth to handle:
 * - POST: Login, registration, and token refresh requests
 * - GET: Session validation, OAuth redirects, and logout
 */
export const { POST, GET } = toNextJsHandler(auth);
