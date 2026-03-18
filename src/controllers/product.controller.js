import { productService } from '../services/product.service.js';
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

export const listProducts   = asyncHandler(async (req, res) => ApiResponse.success(res, await productService.list(req.query)));
export const getProductById = asyncHandler(async (req, res) => ApiResponse.success(res, await productService.getById(req.params.id)));
export const createProduct  = asyncHandler(async (req, res) => ApiResponse.created(res, await productService.create(req.body)));
export const updateProduct  = asyncHandler(async (req, res) => ApiResponse.success(res, await productService.update(req.params.id, req.body)));
export const deleteProduct  = asyncHandler(async (req, res) => { await productService.remove(req.params.id); ApiResponse.noContent(res); });
