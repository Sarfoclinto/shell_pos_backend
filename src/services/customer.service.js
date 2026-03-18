import { customerRepository } from "../repositories/customer.repository.js";
import { ApiError } from "../utils/api-error.js";
import { paginate, paginatedResponse } from "../utils/pagination.js";

export const customerService = {
  async list(query) {
    const { page, limit, offset } = paginate(query);
    const { rows, total } = await customerRepository.search({
      search: query.search,
      limit,
      offset,
    });
    return paginatedResponse(rows, total, page, limit);
  },

  async getById(id) {
    const c = await customerRepository.findById(id);
    if (!c) throw ApiError.notFound("Customer not found");
    return c;
  },

  async create(data) {
    if (data.email) {
      const existing = await customerRepository.findByEmail(data.email);
      if (existing)
        throw ApiError.conflict("A customer with this email already exists");
    }
    return customerRepository.create(data);
  },

  async update(id, data) {
    const c = await customerRepository.findById(id);
    if (!c) throw ApiError.notFound("Customer not found");
    return customerRepository.update(id, data);
  },

  async remove(id) {
    const c = await customerRepository.findById(id);
    if (!c) throw ApiError.notFound("Customer not found");
    return customerRepository.softDelete(id);
  },
};
