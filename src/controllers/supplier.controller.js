import { supplierService } from "../services/supplier.service.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

export const listSuppliers = asyncHandler(async (req, res) => {
  const { suppliers, pagination } = await supplierService.list(req.query);
  return ApiResponse.paginated(
    res,
    suppliers,
    pagination,
    "Suppliers fetched successfully",
  );
});

export const getSupplierById = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await supplierService.getById(req.params.id),
    "Supplier fetched successfully",
  ),
);

export const createSupplier = asyncHandler(async (req, res) =>
  ApiResponse.created(
    res,
    await supplierService.create(req.body, req.user.id),
    "Supplier created successfully",
  ),
);

export const updateSupplier = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await supplierService.update(req.params.id, req.body, req.user.id),
    "Supplier updated successfully",
  ),
);

export const toggleSupplierStatus = asyncHandler(async (req, res) => {
  const result = await supplierService.toggleStatus(req.params.id, req.user.id);
  return ApiResponse.success(
    res,
    result,
    `Supplier ${result.isActive ? "activated" : "deactivated"} successfully`,
  );
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  await supplierService.remove(req.params.id, req.user.id);
  return ApiResponse.noContent(res, "Supplier deleted successfully");
});
