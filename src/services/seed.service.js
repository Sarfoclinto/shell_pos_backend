import { connectDB, query } from "../config/database.js";
import { seedUsers } from "../db/seeds/001_seed_users.js";
import { ApiError } from "../utils/api-error.js";

export const seedService = {
  async seedUsers(secret) {
    if (secret !== "hec-sherlock") {
      throw ApiError.forbidden("Forbidden");
    }
    await connectDB();
    await seedUsers(query);
    return { message: "Migrations and seed complete" };
  },
};
