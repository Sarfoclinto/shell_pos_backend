import { Router } from "express";
import { seedUsers } from "../controllers/seed.controller.js";

const router = Router();

router.post("/users", seedUsers);

export default router;
