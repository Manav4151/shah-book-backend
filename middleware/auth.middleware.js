import { auth, ROLES } from "../lib/auth.js";
import { AppError } from "../lib/api-error.js";

// export const authenticate = async (req, res, next) => {
//   try {
//     const response = await auth.api.getSession({
//       query: { disableCookieCache: true },
//       headers: req.headers,
//     });

//     if (!response.session) {
//       return next(AppError.unauthorized("Unauthorized"));
//     }

//     req.user = response.user;
//     next();
//   } catch (error) {
//     next(
//       AppError.internal("Authentication failed", {
//         originalError: error.message,
//       })
//     );
//   }
// };

 // Import your auth setup


 export const authenticate = async (req, res, next) => {
  try {
        console.log("🟡 Incoming headers:", req.headers.authorization || req.headers.cookie);
    const { session, user } = await auth.api.getSession({
      query: { disableCookieCache: true },
      headers: req.headers,
    });
     console.log("🔵 Better Auth Response: ", { session, user });
    if (!session) {
      return next(AppError.unauthorized("Unauthorized"));
    }

    // Use session.user (contains custom fields)
    req.user = user;

    next();
  } catch (error) {
    next(
      AppError.internal("Authentication failed", {
        originalError: error?.message,
      })
    );
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return next(AppError.unauthorized("Not authenticated"));
    }

    const role = user.role;

    // If no specific roles passed → allow all authenticated users
    const rolesToCheck = allowedRoles.length > 0 ? allowedRoles : Object.values(ROLES);

    // 1️⃣ Role Check
    if (!rolesToCheck.includes(role)) {
      return next(
        AppError.forbidden(
          `Access denied: ${role} is not permitted. Allowed: ${rolesToCheck.join(", ")}`
        )
      );
    }

    // 2️⃣ Multi-Tenant Protection
    if (role !== ROLES.SYSTEM_ADMIN && !user.agentId) {
      return next(
        AppError.forbidden("User does not belong to any agent (tenant). No access allowed.")
      );
    }

    next();
  };
};
