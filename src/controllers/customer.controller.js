import { customerService } from "../services/customer.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

export const listCustomers = asyncHandler(async (req, res) => {
  const { customers, pagination } = await customerService.list(req.query);
  return ApiResponse.paginated(
    res,
    customers,
    pagination,
    "Customers fetched successfully",
  );
});

export const getCustomerById = asyncHandler(async (req, res) => {
  const customer = await customerService.getById(req.params.id);
  return ApiResponse.success(res, customer, "Customer fetched successfully");
});

/**
 * GET /api/v1/customers/phone/:phone
 * Used on the POS screen — cashier types/scans a phone to pull up a customer.
 */
export const getCustomerByPhone = asyncHandler(async (req, res) => {
  const customer = await customerService.getByPhone(req.params.phone);
  return ApiResponse.success(res, customer, "Customer fetched successfully");
});

export const createCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.create(req.body, req.user.id);
  return ApiResponse.created(res, customer, "Customer created successfully");
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.update(
    req.params.id,
    req.body,
    req.user.id,
  );
  return ApiResponse.success(res, customer, "Customer updated successfully");
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  await customerService.remove(req.params.id, req.user.id);
  return ApiResponse.noContent(res, "Customer deleted successfully");
});
