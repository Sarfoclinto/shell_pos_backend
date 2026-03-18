/**
 * Standardised API response builder.
 *
 * Every response follows one of three shapes:
 *
 *   Single   → { meta, data: T | null }
 *   List     → { meta, data: T[] }
 *   Paginated→ { meta, data: T[], pagination }
 *
 * Usage:
 *   ApiResponse.success(res, user, 'Login successful');
 *   ApiResponse.paginated(res, rows, pagination, 'Users fetched');
 *   ApiResponse.noContent(res, 'User deleted');
 */

const buildMeta = (success, message, statusCode, errors = null) => ({
  success,
  message,
  status: statusCode,
  ...(errors?.length ? { errors } : {}),
});

export class ApiResponse {
  // ── 2xx ──────────────────────────────────────

  static success(res, data = null, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
      meta: buildMeta(true, message, statusCode),
      data,
    });
  }

  static created(res, data, message = "Created successfully") {
    return res.status(201).json({
      meta: buildMeta(true, message, 201),
      data,
    });
  }

  static noContent(res, message = "Deleted successfully") {
    // Return 200 with meta instead of 204 so the frontend
    // can read the confirmation message (204 has no body).
    return res.status(200).json({
      meta: buildMeta(true, message, 200),
      data: null,
    });
  }

  static paginated(res, data, pagination, message = "Success") {
    return res.status(200).json({
      meta: buildMeta(true, message, 200),
      data,
      pagination: {
        page: pagination.page,
        pageSize: pagination.limit,
        pageCount: Math.ceil(pagination.total / pagination.limit),
        total: pagination.total,
        hasNextPage:
          pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrevPage: pagination.page > 1,
      },
    });
  }
}
