import { Router } from "express";
import { getQuotations } from "../controllers/quotation.controller.js";

const router = Router();

router.get('/',getQuotations);

export default router;