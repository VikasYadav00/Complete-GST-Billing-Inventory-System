export class HttpError extends Error {
  public statusCode: number;
  public errors?: unknown;
  public code?: string;

  constructor(statusCode: number, message: string, errors?: unknown, code?: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', errors?: unknown, code = 'BAD_REQUEST') {
    super(400, message, errors, code);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', errors?: unknown, code = 'UNAUTHORIZED') {
    super(401, message, errors, code);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden - Access denied', errors?: unknown, code = 'FORBIDDEN') {
    super(403, message, errors, code);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Resource Not Found', errors?: unknown, code = 'NOT_FOUND') {
    super(404, message, errors, code);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Resource Conflict', errors?: unknown, code = 'CONFLICT') {
    super(409, message, errors, code);
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message = 'Unprocessable Entity', errors?: unknown, code = 'UNPROCESSABLE_ENTITY') {
    super(422, message, errors, code);
  }
}
