import { Router } from "express";
import { createCustomer, createPublisher, getPublisherSuggestions } from "../controllers/common.controller.js";

const router = Router();

router.post("/addCustomer", createCustomer);

router.post("/addPublisher", createPublisher);

router.get("/publisher-suggestions", getPublisherSuggestions);

export default router;