import mongoose from "mongoose";
import { AppError } from "../lib/api-error.js";
import { ApiResponse } from "../lib/api-response.js";
import { logActivity } from "../lib/logger.js";
import { Agent } from "../models/agent.schema.js";
import { User } from "../models/user.schema.js";
import { ROLES } from "../lib/auth.js";

export const createAgent = async (req, res) => {
    try {
        const createdBy = req.user._id; // Assuming req.user is populated by authentication middleware
        const { name, description } = req.body;
        const newAgent = new Agent({ name, description, createdBy });
        const savedAgent = await newAgent.save();
        res.status(201).json(savedAgent);
    } catch (error) {
        res.status(500).json({ message: "Error creating agent", error: error.message });
    }
};

export const getAgents = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const sort = req.query.sort || "createdAt:desc";
        const search = req.query.search || "";
        const status = req.query.status || "";

        const [sortField, sortDirection] = sort.split(":");
        const sortOrder = sortDirection === "asc" ? 1 : -1;

        const pipeline = [
            {
                $match: {
                    ...(search && {
                        $or: [
                            { name: { $regex: search, $options: "i" } },
                            { description: { $regex: search, $options: "i" } },
                        ],
                    }),
                    ...(status && { status: status }),
                },
            },
            {
                $project: {
                    name: 1,
                    description: 1,
                    status: 1,
                    adminCount: { $size: "$adminIds" },
                    userCount: { $size: "$userIds" },
                    createdAt: 1,
                    updatedAt: 1,
                },
            },
        ];

        // Get total count
        const countPipeline = [...pipeline];
        countPipeline.push({ $count: "total" });
        const totalResult = await Agent.aggregate(countPipeline);
        const total = totalResult[0]?.total || 0;

        // Add pagination and sorting
        pipeline.push(
            { $sort: { [sortField]: sortOrder } },
            { $skip: (page - 1) * limit },
            { $limit: limit }
        );

        // Execute the main query
        const agents = await Agent.aggregate(pipeline);

        // Get available statuses for filters
        const statusPipeline = [
            {
                $group: {
                    _id: null,
                    statuses: { $addToSet: "$status" },
                },
            },
        ];
        const statusResult = await Agent.aggregate(statusPipeline);
        const statuses = statusResult[0]?.statuses || ["active", "inactive"];

        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        const response = {
            agents,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext,
                hasPrev,
            },
            filters: {
                statuses,
            },
        };

        logActivity(req, "Agents fetched successfully", {
            page,
            limit,
            total,
            totalPages,
        });

        return res
            .status(200)
            .json(ApiResponse.success(response, "Agents fetched successfully"));
    } catch (error) {
        logActivity(
            req,
            "Failed to fetch agents",
            { error: error.message },
            "error"
        );
        return next(
            AppError.internal("Failed to fetch agents", { error: error.message })
        );
    }
};

export const addAdminToAgent = async (req, res) => {
    // Implementation for adding an admin to an agent
    try {
        const { agentId, adminId } = req.body;
        const agent = await Agent.findById(agentId);
        if (!agent) {
            return res.status(404).json({ message: "Agent not found" });
        }
        if (agent.adminIds.includes(adminId)) {
            return res.status(400).json({ message: "User already an admin" });
        }
        agent.adminIds.push(adminId);
        await agent.save();
        await User.findByIdAndUpdate(adminId, { role: "agent_admin", agentId: agentId });

        res.status(200).json({ message: "Admin added to agent successfully", agent });

    } catch (error) {
        res.status(500).json({ message: "Error adding admin to agent", error: error.message });
    }
}

export const addUserToAgent = async (req, res) => {
    try {
        const { agentId, userId, role } = req.body;
        const agent = await Agent.findById(agentId);
        if (!agent) {
            return res.status(404).json({ message: "Agent not found" });
        }
        if (agent.userIds.includes(userId)) {
            return res.status(400).json({ message: "User already added to agent" });
        }
        if (agent.adminIds.includes(userId)) {
            return res.status(400).json({ message: "User is an admin of the agent" });
        }
        agent.userIds.push(userId);
        await agent.save();
        await User.findByIdAndUpdate(userId, { role: role, agentId: agentId });
        res.status(200).json({ message: "User added to agent successfully", agent });
    } catch (error) {
        res.status(500).json({ message: "Error adding user to agent", error: error.message });
    }
};

export const removeAdminFromAgent = async (req, res) => {
    try {
                const { agentId, adminId } = req.body;

        const agent = await Agent.findById(agentId);

        if (!agent) {
            return res.status(404).json({ message: "Agent not found" });
        }
        agent.adminIds = agent.adminIds.filter(id => id.toString() !== adminId);
        await agent.save();
        await User.findByIdAndUpdate(adminId, { role: ROLES.USER, agentId: null });
        res.status(200).json({ message: "Admin removed from agent successfully", agent });
    } catch (error) {
        console.log("error" , error);
        
        res.status(500).json({ message: "Error removing admin from agent", error: error.message });
    }
};
export const removeUserFromAgent = async (req, res) => {
    try {
        const { agentId, userId } = req.body;
        const agent = await Agent.findById(agentId);
        if (!agent) {
            return res.status(404).json({ message: "Agent not found" });
        }
        agent.userIds = agent.userIds.filter(id => id.toString() !== userId);
        await agent.save();
        await User.findByIdAndUpdate(userId, { role: ROLES.USER, agentId: null });
        res.status(200).json({ message: "User removed from agent successfully", agent });
    } catch (error) {
        res.status(500).json({ message: "Error removing user from agent", error: error.message });
    }
};

export const getAgentById = async (req, res) => {
    try {
        const { id } = req.params;
        const agent = await Agent.findById(id)
            .populate('adminIds')
            .populate('userIds');
        if (!agent) {
            return res.status(404).json({ message: "Agent not found" });
        }
        res.status(200).json(agent);
    } catch (error) {
    }
};
