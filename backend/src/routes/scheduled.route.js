import express from "express";
import {
  createScheduled,
  listScheduled,
  cancelScheduled,
} from "../controllers/scheduled.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/", listScheduled);
router.post("/", createScheduled);
router.delete("/:id", cancelScheduled);

export default router;