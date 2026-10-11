import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import {
  UnauthorizedError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../utils/httpErrors.js';
import { ROLES, DEFAULT_ROLE_PERMISSIONS } from '../config/constants.js';
import { AuditService } from './audit.service.js';

export interface RegisterBusinessInput {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  phone: string;
  state?: string;
  stateCode?: string;
  gstin?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuthService {
  /**
   * Register a new Business with Owner account, default roles and settings
   */
  public static async registerBusiness(input: RegisterBusinessInput) {
    const existingUser = await prisma.user.findFirst({
      where: { email: input.email.toLowerCase().trim() },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);

    // Create Business, Settings, Default Roles and Owner User in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Business
      const business = await tx.business.create({
        data: {
          name: input.businessName,
          phone: input.phone,
          email: input.email.toLowerCase().trim(),
          state: input.state || 'Delhi',
          stateCode: input.stateCode || '07',
          gstin: input.gstin ? input.gstin.trim().toUpperCase() : null,
          isGstRegistered: Boolean(input.gstin),
        },
      });

      // 2. Create BusinessSettings
      await tx.businessSettings.create({
        data: {
          businessId: business.id,
          invoicePrefix: 'INV-',
          purchasePrefix: 'PO-',
          quotationPrefix: 'QT-',
          thermalPrinterWidth: '80mm',
        },
      });

      // 3. Create Default Roles with granular permissions
      const roleMap = new Map<string, string>();
      for (const [roleName, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        const role = await tx.role.create({
          data: {
            businessId: business.id,
            name: roleName,
            displayName: roleName.replace('_', ' '),
            isSystem: true,
            permissions: {
              create: permissions.map((p) => ({
                resource: p.resource,
                action: p.action,
              })),
            },
          },
        });
        roleMap.set(roleName, role.id);
      }

      // 4. Create Owner User
      const ownerRoleId = roleMap.get(ROLES.OWNER)!;
      const user = await tx.user.create({
        data: {
          businessId: business.id,
          name: input.ownerName,
          email: input.email.toLowerCase().trim(),
          phone: input.phone,
          passwordHash,
          roleId: ownerRoleId,
        },
        include: {
          role: {
            include: { permissions: true },
          },
        },
      });

      // 5. Seed default expense categories
      const defaultCategories = [
        'Rent & Premises',
        'Electricity & Utilities',
        'Staff Salary & Wages',
        'Transportation & Freight',
        'Packaging Material',
        'Marketing & Promotion',
        'Shop Maintenance',
        'Miscellaneous',
      ];

      for (const catName of defaultCategories) {
        await tx.expenseCategory.create({
          data: {
            businessId: business.id,
            name: catName,
          },
        });
      }

      return { business, user };
    }, { maxWait: 20000, timeout: 60000 });

    // Record audit log
    await AuditService.log({
      businessId: result.business.id,
      userId: result.user.id,
      action: 'REGISTER_BUSINESS',
      entity: 'Business',
      entityId: result.business.id,
      newValues: { businessName: input.businessName, ownerEmail: input.email },
    });

    const tokens = await this.generateTokenPair(result.user);

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role.name,
        businessId: result.business.id,
        businessName: result.business.name,
      },
      ...tokens,
    };
  }

  /**
   * User Login
   */
  public static async login(input: LoginInput) {
    const user = await prisma.user.findFirst({
      where: { email: input.email.toLowerCase().trim() },
      include: {
        business: true,
        role: {
          include: { permissions: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated. Contact owner.');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokenPair(user, input.ipAddress, input.userAgent);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        businessId: user.business.id,
        businessName: user.business.name,
        permissions: user.role.permissions.map((p) => ({
          resource: p.resource,
          action: p.action,
        })),
        preferredLanguage: user.preferredLanguage,
      },
      ...tokens,
    };
  }

  /**
   * Refresh Token rotation
   */
  public static async refreshAccessToken(
    refreshTokenStr: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenStr },
      include: {
        user: {
          include: {
            business: true,
            role: {
              include: { permissions: true },
            },
          },
        },
      },
    });

    if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Revoke old refresh token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    const tokens = await this.generateTokenPair(storedToken.user, ipAddress, userAgent);

    return {
      user: {
        id: storedToken.user.id,
        name: storedToken.user.name,
        email: storedToken.user.email,
        role: storedToken.user.role.name,
        businessId: storedToken.user.business.id,
        businessName: storedToken.user.business.name,
      },
      ...tokens,
    };
  }

  /**
   * Logout user by revoking refresh token
   */
  public static async logout(refreshTokenStr: string): Promise<void> {
    if (!refreshTokenStr) return;
    await prisma.refreshToken
      .updateMany({
        where: { token: refreshTokenStr },
        data: { revoked: true },
      })
      .catch(() => {});
  }

  /**
   * Change user password
   */
  public static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestError('Incorrect current password');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestError('New password must be different from current password');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revoke previous refresh tokens for security
    await prisma.refreshToken
      .updateMany({
        where: { userId },
        data: { revoked: true },
      })
      .catch(() => {});

    await AuditService.log({
      businessId: user.businessId,
      userId: user.id,
      action: 'UPDATE_PASSWORD',
      entity: 'User',
      entityId: user.id,
      newValues: { message: 'Password updated successfully' },
    });

    return { message: 'Password updated successfully' };
  }

  /**
   * Helper to generate JWT Access Token and secure Refresh Token
   */
  private static async generateTokenPair(
    user: { id: string; businessId: string; role: { name: string } },
    ipAddress?: string,
    userAgent?: string
  ) {
    const accessToken = jwt.sign(
      {
        userId: user.id,
        businessId: user.businessId,
        role: user.role.name,
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const refreshTokenValue = crypto.randomBytes(40).toString('hex');
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshTokenValue,
        expiresAt: refreshExpiresAt,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: 900, // 15 mins in seconds
    };
  }
}
