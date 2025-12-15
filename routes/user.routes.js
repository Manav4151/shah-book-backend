import { Router } from "express";
import { getAllUsers } from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const route = Router();
route.use(authenticate);
route.get('/get-users', getAllUsers);

export default route;