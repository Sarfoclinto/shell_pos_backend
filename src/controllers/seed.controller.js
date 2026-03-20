import { seedService } from "../services/seed.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * Post /api/seed/users
 * Body: { secret }
 *
 * Protected route to run DB migrations and seed initial user data.
 * Requires ?secret=hec-sherlock to prevent unauthorized access. In production, this should be further protected or removed entirely.
 */
export const seedUsers = asyncHandler(async (req, res) => {
  const secret = req.body.secret ?? "";
  const result = await seedService.seedUsers(secret);

  return ApiResponse.success(res, result, "Seed complete");
});
