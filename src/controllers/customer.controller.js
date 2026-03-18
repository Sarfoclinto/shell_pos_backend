import { customerService } from '../services/customer.service.js';
import { ApiResponse } from '../utils/api-response.js';
import { asyncHandler } from '../utils/async-handler.js';

export const listCustomers   = asyncHandler(async (req, res) => ApiResponse.success(res, await customerService.list(req.query)));
export const getCustomerById = asyncHandler(async (req, res) => ApiResponse.success(res, await customerService.getById(req.params.id)));
export const createCustomer  = asyncHandler(async (req, res) => ApiResponse.created(res, await customerService.create(req.body)));
export const updateCustomer  = asyncHandler(async (req, res) => ApiResponse.success(res, await customerService.update(req.params.id, req.body)));
export const deleteCustomer  = asyncHandler(async (req, res) => { await customerService.remove(req.params.id); ApiResponse.noContent(res); });
