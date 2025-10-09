import { Router } from "express";
import { createCustomer, createPublisher } from "../controllers/common.controller.js";

const router = Router();

router.post("/addCustomer", createCustomer);

router.post("/addPublisher", createPublisher);

export default router;