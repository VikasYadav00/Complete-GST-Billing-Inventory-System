import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/httpErrors.js';
import { AuthenticatedRequest, AuthUser } from '../types/index.js';

interface JwtPayload {
  userId: string;
  businessId: string;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token missing or invalid');
    }

    const token = authHeader.substring(7);
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    } catch (jwtErr) {
      throw new UnauthorizedError('Token expired or invalid signature');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account is deactivated');
    }

    if (user.businessId !== decoded.businessId) {
      throw new UnauthorizedError('Invalid tenant scope');
    }

    const authUser: AuthUser = {
      id: user.id,
      businessId: user.businessId,
      role: user.role.name,
      email: user.email,
      name: user.name,
      permissions: user.role.permissions.map((p) => ({
        resource: p.resource,
        action: p.action,
      })),
    };

    req.user = authUser;
    req.businessId = user.businessId;

    next();
  } catch (error) {
    next(error);
  }
};
