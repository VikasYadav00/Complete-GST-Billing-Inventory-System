import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { ForbiddenError, UnauthorizedError } from '../utils/httpErrors.js';
import { ROLES } from '../config/constants.js';

export const requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (req.user.role === ROLES.OWNER) {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Role '${req.user.role}' is not authorized for this resource.`
        )
      );
    }

    next();
  };
};

export const requirePermission = (resource: string, action: string) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // Business Owner always has full administrative rights
    if (req.user.role === ROLES.OWNER) {
      return next();
    }

    // Check wildcard or specific permissions
    const hasPermission = req.user.permissions.some(
      (p) =>
        (p.resource === '*' || p.resource === resource) &&
        (p.action === '*' || p.action === action || p.action === 'manage')
    );

    if (!hasPermission) {
      return next(
        new ForbiddenError(
          `Permission denied: Requires '${action}' on '${resource}'.`
        )
      );
    }

    next();
  };
};
