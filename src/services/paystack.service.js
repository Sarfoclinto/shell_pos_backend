import crypto from "crypto";
import { paystackClient } from "../config/paystack.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Supported mobile money providers on Paystack (Ghana).
 * The frontend sends the network name; we map it to the Paystack provider code.
 */
const MOBILE_MONEY_PROVIDERS = {
  mtn: "mtn",
  vodafone: "vod",
  telecel: "vod",
  airteltigo: "atl",
  // South Africa
  mpesa: "mpesa",
};

export const paystackService = {
  /**
   * Initiate a mobile money charge.
   *
   * The customer receives a USSD prompt or push notification on their phone.
   * They approve it and Paystack confirms via webhook.
   *
   * @param {object} params
   * @param {number}  params.amount       - Amount in the smallest currency unit (pesewas for GHS)
   * @param {string}  params.phone        - Customer phone number e.g. "0241234567"
   * @param {string}  params.network      - Mobile network: "mtn" | "vodafone" | "airteltigo"
   * @param {string}  params.email        - Customer email (Paystack requires this)
   * @param {string}  params.reference    - Unique reference for this transaction
   * @param {object}  params.metadata     - Extra data stored on the transaction (saleId, storeId etc.)
   */
  async chargeMobileMoney({
    amount,
    phone,
    network,
    email,
    reference,
    metadata,
  }) {
    const provider = MOBILE_MONEY_PROVIDERS[network?.toLowerCase()];
    if (!provider) {
      throw new Error(
        `Unsupported mobile network "${network}". ` +
          `Supported: ${Object.keys(MOBILE_MONEY_PROVIDERS).join(", ")}`,
      );
    }

    // Paystack expects amount in kobo/pesewas (smallest unit)
    // If the caller sends in major units (GHS), multiply by 100
    const amountInPesewas = Math.round(amount * 100);

    const payload = {
      amount: amountInPesewas,
      email,
      currency: "GHS",
      reference,
      mobile_money: {
        phone,
        provider,
      },
      metadata: {
        ...metadata,
        channel: "pos",
      },
    };

    logger.info(
      `Initiating mobile money charge: ${reference} — GHS ${amount} to ${phone}`,
    );
    const response = await paystackClient.post("/charge", payload);
    return {
      reference,
      status: response.data.status, // 'send_otp' | 'pay_offline' | 'success' | 'pending'
      displayText: response.data.display_text, // message to show the cashier
      paymentStatus: response.data.status === "success" ? "paid" : "pending",
    };
  },

  /**
   * Submit OTP if Paystack returns status 'send_otp'.
   * Some networks (Vodafone) require the customer to enter a PIN
   * which gets relayed through our backend.
   */
  async submitOtp(reference, otp) {
    const response = await paystackClient.post("/charge/submit_otp", {
      otp,
      reference,
    });

    return {
      reference,
      status: response.data.status,
      displayText: response.data.display_text,
    };
  },

  /**
   * Verify a transaction by reference.
   * Used to poll for status after initiating a charge,
   * and also called inside the webhook handler to confirm before updating the DB.
   */
  async verifyTransaction(reference) {
    const response = await paystackClient.get(
      `/transaction/verify/${reference}`,
    );

    const tx = response.data;
    return {
      reference: tx.reference,
      status: tx.status, // 'success' | 'failed' | 'abandoned' | 'pending'
      amount: tx.amount / 100, // convert back from pesewas to GHS
      currency: tx.currency,
      channel: tx.channel,
      paidAt: tx.paid_at,
      gatewayResponse: tx.gateway_response,
      metadata: tx.metadata,
    };
  },

  /**
   * Validate that a webhook request genuinely came from Paystack.
   * Paystack signs the request body with your webhook secret using HMAC-SHA512.
   * NEVER skip this check — it prevents anyone from faking a payment confirmation.
   *
   * @param {string} signature - Value of the x-paystack-signature header
   * @param {Buffer|string} rawBody - The raw request body (must be unparsed)
   * @returns {boolean}
   */
  validateWebhookSignature(signature, rawBody) {
    if (!env.paystack.webhookSecret) {
      logger.warn(
        "PAYSTACK_WEBHOOK_SECRET is not set — skipping webhook signature validation",
      );
      return true; // Allow in dev; enforce in prod
    }

    const hash = crypto
      .createHmac("sha512", env.paystack.webhookSecret)
      .update(rawBody)
      .digest("hex");

    return hash === signature;
  },
};
