import { env } from "./env.js";
import { logger } from "../utils/logger.js";

/**
 * Lightweight Paystack HTTP client.
 * We use native fetch (Node 18+) instead of a third-party SDK
 * so we have full control over the request/response cycle.
 *
 * All requests are authenticated with the secret key via
 * the Authorization header — the frontend never sees this key.
 */

const BASE_URL = env.paystack.baseUrl;

const paystackHeaders = () => ({
  Authorization: `Bearer ${env.paystack.secretKey}`,
  "Content-Type": "application/json",
  "Cache-Control": "no-cache",
});

const handleResponse = async (res, endpoint) => {
  const data = await res.json();

  if (!res.ok) {
    logger.error(`Paystack API error [${endpoint}]:`, {
      status: res.status,
      message: data.message,
    });
    throw new Error(data.message || `Paystack request failed (${res.status})`);
  }

  return data;
};

export const paystackClient = {
  /**
   * POST to a Paystack endpoint.
   */
  async post(endpoint, body) {
    console.log("uri: ", `${BASE_URL}${endpoint}`);
    console.log("body: ", body);
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: paystackHeaders(),
      body: JSON.stringify(body),
    });
    console.log("res: ", await res.clone().json());

    return handleResponse(res, endpoint);
  },

  /**
   * GET from a Paystack endpoint.
   */
  async get(endpoint) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "GET",
      headers: paystackHeaders(),
    });
    return handleResponse(res, endpoint);
  },
};
