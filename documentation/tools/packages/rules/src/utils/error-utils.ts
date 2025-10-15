export interface FileSystemError extends Error {
  code: string;
  path: string;
  syscall: string;
}

export function categorizeError(error: unknown): 'suppress' | 'warn' | 'fail' {
  if (error instanceof Error && 'code' in error) {
    const fsError = error as FileSystemError;
    switch (fsError.code) {
      case 'ENOENT': // File/directory not found
      case 'ENOTDIR': // Not a directory
      case 'EACCES': // Permission denied - suppress for backward compatibility
        return 'suppress';

      case 'EPERM': // Operation not permitted
        return 'warn';

      case 'EMFILE': // Too many open files
      case 'ENFILE': // File table overflow
      case 'ENOMEM': // Out of memory
      case 'ENOSPC': // No space left on device
        return 'fail';

      default:
        return 'fail';
    }
  }
  return 'fail';
}

export async function safeFileOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  filePath?: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const category = categorizeError(error);

    switch (category) {
      case 'suppress':
        return null;

      case 'warn':
        console.warn(
          `${operationName} warning: ${error instanceof Error ? error.message : 'Unknown error'}${filePath ? ` (${filePath})` : ''}`
        );
        return null;

      case 'fail':
      default:
        throw new Error(
          `${operationName} failed: ${error instanceof Error ? error.message : 'Unknown error'}${filePath ? ` (${filePath})` : ''}`
        );
    }
  }
}

// Update existing shouldSuppressError function
export function shouldSuppressError(error: unknown): boolean {
  return categorizeError(error) === 'suppress';
}
