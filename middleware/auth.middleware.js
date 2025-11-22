import { auth, ROLES } from "../lib/auth.js";
import { AppError } from "../lib/api-error.js";

export const authenticate = async (req, res, next) => {
  try {
    const response = await auth.api.getSession({
      query: { disableCookieCache: true },
      headers: req.headers,
    });

    if (!response.session) {
      return next(AppError.unauthorized("Unauthorized"));
    }

    req.user = response.user;
    next();
  } catch (error) {
    next(
      AppError.internal("Authentication failed", {
        originalError: error.message,
      })
    );
  }
};

 // Import your auth setup

export const authorizeRoles = (...allowedRoles) => {
  // 1. Use the Constant, don't hardcode strings
  const ALL_ROLES = Object.values(ROLES); 

  // If no roles passed, allow any authenticated user with a valid role
  const finalRoles = allowedRoles.length > 0 ? allowedRoles : ALL_ROLES;

  return async (req, res, next) => {
    try {
      const response = await auth.api.getSession({
        query: { 
            disableCookieCache: true // Good! Keeps permissions fresh
        },
        headers: req.headers,
      });

      if (!response || !response.session) {
        return next(AppError.unauthorized("Unauthorized - Please log in"));
      }

      // Attach user to request so you can use req.user.id in your controllers later
      req.user = response.user;

      // 2. Check if the user's role is in the allowed list
      if (!finalRoles.includes(req.user.role)) {
        return next(
          AppError.forbidden(
            `Access denied. You are a ${req.user.role}, but this requires: ${finalRoles.join(", ")}`
          )
        );
      }

      next();
    } catch (error) {
      // Log the actual error for debugging, pass a safe error to user
      console.error("Auth Middleware Error:", error);
      next(AppError.internal("Authentication check failed"));
    }
  };
};