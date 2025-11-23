# Changelog

## 1.0.2
- Improved error handling for PostgreSQL connection notices

## 1.0.1

- Improved TypeScript type definitions for better IDE support and type checking
- Fixed teardown queue type handling for better error detection

## 1.0.0

- Added custom Vitest matchers: `toEmit` for event testing, `toEqualSorted` for order-independent array comparison, and `tsStringIsEqual` for TypeScript type string comparison
- Added automatic database cleanup utilities with teardown queue management for PostgreSQL testing
- Added Vitest setup and teardown hooks with automatic test name resolution
- Added TypeScript utility functions for type string comparison
- Published package to npm as `@goodfoot/test-utilities`
