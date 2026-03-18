import { reportService } from '../services/report.service.js';
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

const defaultRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString(), to: to.toISOString() };
};

export const salesSummary = asyncHandler(async (req, res) => {
  const { from, to } = { ...defaultRange(), ...req.query };
  return ApiResponse.success(res, await reportService.salesSummary({ from, to }));
});

export const topProducts = asyncHandler(async (req, res) => {
  const { from, to, limit } = { ...defaultRange(), ...req.query };
  return ApiResponse.success(res, await reportService.topProducts({ from, to, limit }));
});

export const dailySales = asyncHandler(async (req, res) => {
  const { from, to } = { ...defaultRange(), ...req.query };
  return ApiResponse.success(res, await reportService.dailySales({ from, to }));
});
