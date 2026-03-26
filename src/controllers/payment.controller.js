import { v4 as uuidv4 } from "uuid";
import { paystackService } from "../services/paystack.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { query } from "../config/database.js";
import { logger } from "../utils/logger.js";

/**
 * POST /api/v1/payments/mobile-money
 *
 * Initiates a mobile money charge via Paystack.
 * The customer receives a prompt on their phone to approve.
 * The cashier waits on the POS screen — no redirect needed.
 *
 * Body: {
 *   amount:    number    — in GHS (e.g. 45.00)
 *   phone:     string    — customer phone e.g. "0241234567"
 *   network:   string    — "mtn" | "vodafone" | "airteltigo"
 *   email:     string    — customer email (required by Paystack)
 *   saleId?:   string    — attach to a sale for webhook reconciliation
 * }
 */
export const initiateMobileMoneyCharge = asyncHandler(async (req, res) => {
  const { amount, phone, network, email, saleId } = req.body;

  if (!amount || amount <= 0)
    throw ApiError.badRequest("Amount must be greater than 0");
  if (!phone) throw ApiError.badRequest("Customer phone number is required");
  if (!network)
    throw ApiError.badRequest(
      "Mobile network is required (mtn, vodafone, airteltigo)",
    );
  if (!email) throw ApiError.badRequest("Customer email is required");

  // Generate a unique reference for this transaction
  // Format: POS-{storeCode}-{timestamp}-{short uuid}
  const reference = `POS-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

  const result = await paystackService.chargeMobileMoney({
    amount,
    phone,
    network,
    email,
    reference,
    metadata: {
      saleId: saleId ?? null,
      cashierId: req.user.id,
      storeId: req.user.storeId,
    },
  });

  return ApiResponse.success(
    res,
    result,
    result.displayText ?? "Charge initiated — awaiting customer approval",
  );
});

/**
 * POST /api/v1/payments/mobile-money/otp
 *
 * Some networks (Vodafone) return status 'send_otp' after the initial charge.
 * The customer generates a token from their phone (*110*1#) and the cashier
 * enters it here to complete the transaction.
 *
 * Body: { reference: string, otp: string }
 */
export const submitOtp = asyncHandler(async (req, res) => {
  const { reference, otp } = req.body;

  if (!reference)
    throw ApiError.badRequest("Transaction reference is required");
  if (!otp) throw ApiError.badRequest("OTP is required");

  const result = await paystackService.submitOtp(reference, otp);
  return ApiResponse.success(
    res,
    result,
    result.displayText ?? "OTP submitted",
  );
});

/**
 * GET /api/v1/payments/verify/:reference
 *
 * Polls the status of a Paystack transaction.
 * The POS screen calls this every few seconds after initiating a charge
 * until status is 'success' or 'failed'.
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  const { reference } = req.params;
  if (!reference) throw ApiError.badRequest("Reference is required");

  const result = await paystackService.verifyTransaction(reference);
  return ApiResponse.success(res, result, "Transaction status fetched");
});

/**
 * POST /api/v1/payments/webhook
 *
 * Paystack calls this endpoint when a transaction status changes.
 * This is how we get the final confirmation that a customer approved
 * the mobile money prompt.
 *
 * IMPORTANT:
 * - This route must use raw body parsing (not express.json) so we can
 *   validate the HMAC signature against the unparsed body.
 * - It is NOT authenticated with JWT — Paystack calls it directly.
 * - We validate the Paystack signature instead.
 * - We always respond with 200 immediately, then process asynchronously.
 *   Paystack will retry if it doesn't receive a 200 within 5 seconds.
 */
export const handleWebhook = async (req, res) => {
  // Respond immediately — Paystack needs a 200 fast
  res.status(200).send("OK");

  try {
    const signature = req.headers["x-paystack-signature"];
    const isValid = paystackService.validateWebhookSignature(
      signature,
      req.rawBody,
    );

    if (!isValid) {
      logger.warn("Paystack webhook received with invalid signature — ignored");
      return;
    }

    const event = req.body;
    logger.info(`Paystack webhook received: ${event.event}`, {
      reference: event.data?.reference,
    });

    // Handle the events we care about
    switch (event.event) {
      case "charge.success":
        await handleChargeSuccess(event.data);
        break;

      case "charge.failed":
        await handleChargeFailed(event.data);
        break;

      default:
        // Ignore events we don't handle (subscriptions, refunds, etc.)
        logger.debug(`Paystack webhook ignored: ${event.event}`);
    }
  } catch (err) {
    // Never throw from a webhook handler — the 200 is already sent
    logger.error("Paystack webhook processing error:", err);
  }
};

// ── Webhook event handlers ────────────────────────────────────────────────────

/**
 * charge.success — customer approved the mobile money prompt.
 * If the charge was tied to a sale (via metadata.saleId),
 * we update that payment's status to 'paid'.
 */
const handleChargeSuccess = async (data) => {
  const { reference, metadata, amount } = data;
  const saleId = metadata?.saleId;

  logger.info(`Charge success: ${reference} — GHS ${amount / 100}`);

  if (saleId) {
    // Update the payment record that matches this reference
    const { rowCount } = await query(
      `UPDATE payments
       SET payment_status = 'paid',
           reference_number = $1,
           paid_at = NOW()
       WHERE sale_id = $2
         AND payment_status = 'pending'
         AND payment_method IN ('mobile_money', 'split')`,
      [reference, saleId],
    );

    if (rowCount > 0) {
      logger.info(`Payment updated to paid for sale ${saleId}`);
    }
  }
};

/**
 * charge.failed — customer rejected or timed out.
 * Update the payment status so the cashier knows to retry.
 */
const handleChargeFailed = async (data) => {
  const { reference, metadata } = data;
  const saleId = metadata?.saleId;

  logger.info(`Charge failed: ${reference}`);

  if (saleId) {
    await query(
      `UPDATE payments
       SET payment_status = 'failed'
       WHERE sale_id = $1
         AND payment_status = 'pending'`,
      [saleId],
    );
  }
};
