import { Request } from 'express';

export interface AuthUser {
  id: string;
  businessId: string;
  role: string;
  email: string;
  name: string;
  permissions: { resource: string; action: string }[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  businessId?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ApiSuccessResponse<T> {
  success: true;
  message?: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: unknown;
  code?: string;
}
