export class DatabaseError extends Error {
  constructor(
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} with ID '${id}' not found.`);
    this.name = 'NotFoundError';
  }
}

export class TitleConflictError extends ValidationError {
  constructor(entity: string, title: string) {
    super(`${entity} with title '${title}' already exists.`);
    this.name = 'TitleConflictError';
  }
}

export class MissingForceFlagError extends ValidationError {
  constructor(operation: string) {
    super(`Operation '${operation}' requires 'force=true' to proceed due to its destructive nature.`);
    this.name = 'MissingForceFlagError';
  }
}

export class InvalidIdError extends ValidationError {
  constructor(id: string, expectedPrefix?: string) {
    let message = `Invalid ID format: '${id}'.`;
    if (expectedPrefix) {
      message += ` Expected prefix '${expectedPrefix}:'.`;
    }
    super(message);
    this.name = 'InvalidIdError';
  }
}

export class InvalidParameterError extends ValidationError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidParameterError';
  }
}

export class ReorderMismatchError extends ValidationError {
  constructor(message: string) {
    super(message);
    this.name = 'ReorderMismatchError';
  }
}
