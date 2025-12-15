import { Router } from "express";
import { addAdminToAgent, addUserToAgent, createAgent, getAgentById, getAgents, removeAdminFromAgent, removeUserFromAgent } from "../controllers/agent.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const route = Router();
route.use(authenticate); // Add authentication/authorization middleware as needed
route.post("/",createAgent);
route.get("/get-agents",getAgents);
route.post("/add-admin", addAdminToAgent);
route.post("/add-user", addUserToAgent);
route.post("/remove-admin",removeAdminFromAgent);
route.post("/remove-user", removeUserFromAgent);
route.get("/:id",getAgentById);
export default route;