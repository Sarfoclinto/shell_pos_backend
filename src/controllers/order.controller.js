import { orderService } from '../services/order.service.js';
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

export const listOrders  = asyncHandler(async (req, res) => ApiResponse.success(res, await orderService.list(req.query)));
export const getOrderById = asyncHandler(async (req, res) => ApiResponse.success(res, await orderService.getById(req.params.id)));
export const createOrder  = asyncHandler(async (req, res) => ApiResponse.created(res, await orderService.create({ ...req.body, cashier_id: req.user.id })));
export const cancelOrder  = asyncHandler(async (req, res) => ApiResponse.success(res, await orderService.cancel(req.params.id, req.user.id)));
