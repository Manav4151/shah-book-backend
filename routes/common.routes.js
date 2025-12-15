import { Router } from "express";
import { createCustomer, createPublisher, getCustomer, getPublisherSuggestions } from "../controllers/common.controller.js";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";
import { ROLES } from "../lib/auth.js";

const router = Router();

router.post("/addCustomer",authenticate, authorizeRoles(ROLES.SALES_EXECUTIVE, ROLES.AGENT_ADMIN , ROLES.INVENTORY_MANAGER), createCustomer);

router.post("/addPublisher", createPublisher);

router.get("/publisher-suggestions", getPublisherSuggestions);

router.get("/customerlist",authenticate,
  authorizeRoles(ROLES.AGENT_ADMIN, ROLES.INVENTORY_MANAGER, ROLES.SALES_EXECUTIVE , ROLES.SYSTEM_ADMIN), getCustomer);

export default router;