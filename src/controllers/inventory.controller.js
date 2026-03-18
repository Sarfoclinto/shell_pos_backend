import { inventoryService } from '../services/inventory.service.js';
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

export const getInventory  = asyncHandler(async (req, res) => ApiResponse.success(res, await inventoryService.getByProduct(req.params.productId)));
export const adjustStock   = asyncHandler(async (req, res) => ApiResponse.success(res, await inventoryService.adjust(req.params.productId, req.body)));
export const getLowStock   = asyncHandler(async (req, res) => ApiResponse.success(res, await inventoryService.getLowStock()));
export const setThresholds = asyncHandler(async (req, res) => ApiResponse.success(res, await inventoryService.updateThresholds(req.params.productId, req.body)));
