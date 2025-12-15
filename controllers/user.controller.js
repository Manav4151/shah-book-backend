import { ApiResponse } from "../lib/api-response.js";
import { User } from "../models/user.schema.js";

// export const getAllUsers = async (req, res) => {
//     try {
//         const users = await User.find({});
//         res.status(200).json(ApiResponse.success(users , "Users fetched successfully"));        
//     } catch (error) {
//         res.status(500).json(ApiResponse.error("Failed to fetch users", { error: error.message }));
//     }
// }

export const getAllUsers = async (req, res) => {
    try {
        const loggedInRole = req.user.role;

        let query = {};

        if (loggedInRole === "system_admin") {
            // Remove all system admins
            query.role = { $ne: "system_admin" };
        }

        if (loggedInRole === "agent_admin") {
            // Remove system admin and all agent admins
            query.role = { $nin: ["system_admin", "agent_admin"] };
        }

        const users = await User.find(query);

        return res
            .status(200)
            .json(ApiResponse.success(users, "Users fetched successfully"));

    } catch (error) {
        return res
            .status(500)
            .json(ApiResponse.error("Failed to fetch users", { error: error.message }));
    }
};
