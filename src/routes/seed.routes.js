import { Router } from "express";
import { query, connectDB } from "../config/database.js";
import { runMigrations } from "../db/migrate.js";
import { seedUsers } from "../db/seeds/001_seed_users.js";

const router = Router();

router.get("/users", async (req, res) => {
  const secret = req.query.secret;
  if (secret !== "hec-sherlock") {
    return res.status(403).json({ message: "Forbidden" });
  }
  try {
    await runMigrations();
    await connectDB();
    await seedUsers(query);
    return res.json({ message: "Migrations and seed complete" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;
