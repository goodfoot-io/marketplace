import * as fs from 'fs';
import * as path from 'path';
import {
  Project,
  ScriptTarget,
  ModuleKind,
  ModuleResolutionKind,
  SyntaxKind,
  type SourceFile,
  type ExportedDeclarations
} from 'ts-morph';

interface TypeInfo {
  name: string;
  declaration?: string;
  simplified?: unknown;
  error?: string;
}

interface FileResult {
  file: string;
  exports: TypeInfo[];
}

interface TypeExtractorOptions {
  paths: string[];
  pwd?: string;
  typeFilters?: string[];
}

/**
 * Extracts TypeScript type definitions from files or npm packages
 */
export class TypeExtractor {
  private options: TypeExtractorOptions;
  private project: Project;

  constructor(options: TypeExtractorOptions) {
    this.options = options;

    // Initialize ts-morph Project with proper compiler options
    this.project = new Project({
      compilerOptions: {
        target: ScriptTarget.ES2022,
        module: ModuleKind.CommonJS,
        strict: true,
        skipLibCheck: true,
        declaration: true,
        emitDeclarationOnly: true,
        esModuleInterop: true,
        moduleResolution: ModuleResolutionKind.NodeJs
      }
    });
  }

  /**
   * Check if a node has an optional question token
   */
  private hasOptionalToken(node: unknown): boolean {
    if (node && typeof node === 'object' && 'hasQuestionToken' in node) {
      const hasToken = node.hasQuestionToken;
      if (typeof hasToken === 'function') {
        const result = hasToken.call(node) as unknown;
        return Boolean(result);
      }
    }
    return false;
  }

  /**
   * Execute type extraction and return results
   */
  public execute(): FileResult[] {
    const results: FileResult[] = [];

    for (const inputPath of this.options.paths) {
      const resolvedPath = this.resolvePath(inputPath);

      if (!resolvedPath) {
        continue;
      }

      // Check if it's a file or directory
      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        const sourceFile = this.project.addSourceFileAtPath(resolvedPath);
        results.push(this.processSourceFile(sourceFile));
      } else if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
        // Try to resolve as a module directory
        const moduleFile = this.resolveModuleDirectory(resolvedPath);
        if (moduleFile) {
          const sourceFile = this.project.addSourceFileAtPath(moduleFile);
          results.push(this.processSourceFile(sourceFile));
        }
      }
    }

    // Filter results if type filters are specified
    if (this.options.typeFilters && this.options.typeFilters.length > 0) {
      return results
        .map((fileResult) => {
          const filteredExports = fileResult.exports.filter((exp) => this.options.typeFilters!.includes(exp.name));

          if (filteredExports.length > 0) {
            return {
              ...fileResult,
              exports: filteredExports
            };
          }
          return null;
        })
        .filter((result): result is FileResult => result !== null);
    }

    return results;
  }

  /**
   * Resolve a path (file or package) to an absolute file path
   */
  private resolvePath(inputPath: string): string | null {
    // Check if it's an npm package (starts with @ or is a bare package name)
    const isNpmPackage =
      inputPath.startsWith('@') ||
      (!inputPath.startsWith('.') && !inputPath.startsWith('/') && !inputPath.match(/^[a-zA-Z0-9-]+\//));

    if (isNpmPackage) {
      const basePath = this.options.pwd || process.cwd();
      const packagePath = this.resolveNpmPackage(inputPath, basePath);
      if (packagePath) {
        return packagePath;
      }
      return null;
    } else {
      return this.options.pwd ? path.resolve(this.options.pwd, inputPath) : path.resolve(inputPath);
    }
  }

  /**
   * Resolve a module directory to its main type definition file
   */
  private resolveModuleDirectory(resolvedPath: string): string | null {
    try {
      // Try to find package.json
      const packageJsonPath = path.join(resolvedPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as Record<string, unknown>;
        const typesEntry = (packageJson.types as string) || (packageJson.typings as string) || 'index.d.ts';
        const typesPath = path.join(resolvedPath, typesEntry);

        if (fs.existsSync(typesPath)) {
          return typesPath;
        }
      } else {
        // Try common type definition locations
        const possiblePaths = [
          path.join(resolvedPath, 'index.d.ts'),
          path.join(resolvedPath, 'index.ts'),
          path.join(resolvedPath, 'types.d.ts'),
          path.join(resolvedPath, 'types', 'index.d.ts')
        ];

        for (const possiblePath of possiblePaths) {
          if (fs.existsSync(possiblePath)) {
            return possiblePath;
          }
        }
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  /**
   * Process a source file and extract exported types
   */
  private processSourceFile(sourceFile: SourceFile): FileResult {
    const filePath = sourceFile.getFilePath();
    const exports: TypeInfo[] = [];

    // Get all exported declarations
    const exportedDeclarations = sourceFile.getExportedDeclarations();

    exportedDeclarations.forEach((declarations, name) => {
      declarations.forEach((declaration) => {
        const typeInfo: TypeInfo = {
          name: name
        };

        try {
          // Get the full declaration
          typeInfo.declaration = this.getFullDeclaration(declaration);

          // Get the simplified type for supported declarations
          if (
            declaration.isKind(SyntaxKind.TypeAliasDeclaration) ||
            declaration.isKind(SyntaxKind.InterfaceDeclaration)
          ) {
            const type = declaration.getType();
            typeInfo.simplified = this.simplifyType(type, 10, new Set());
          } else if (declaration.isKind(SyntaxKind.VariableDeclaration)) {
            const type = declaration.getType();
            typeInfo.simplified = this.simplifyType(type, 10, new Set());
          } else if (declaration.isKind(SyntaxKind.FunctionDeclaration)) {
            const functionType = declaration.getType();
            const callSignatures = functionType.getCallSignatures();
            if (callSignatures.length > 0) {
              typeInfo.simplified = this.simplifySignature(callSignatures[0], 10, new Set());
            }
          } else if (declaration.isKind(SyntaxKind.ClassDeclaration)) {
            const type = declaration.getType();
            typeInfo.simplified = this.simplifyType(type, 10, new Set());
          }
        } catch (err: unknown) {
          typeInfo.error = err instanceof Error ? err.message : 'Unknown error';
        }

        exports.push(typeInfo);
      });
    });

    return {
      file: filePath,
      exports: exports
    };
  }

  /**
   * Get full declaration text for a declaration node
   */
  private getFullDeclaration(declaration: ExportedDeclarations): string {
    if (declaration.isKind(SyntaxKind.FunctionDeclaration)) {
      const name = declaration.getName();
      const typeParams = declaration.getTypeParameters();
      const params = declaration.getParameters();
      const returnType = declaration.getReturnType();

      let sig = `function ${name}`;

      if (typeParams && typeParams.length > 0) {
        sig += `<${typeParams.map((tp) => tp.getText()).join(', ')}>`;
      }

      const paramStrs = params.map((p) => {
        const paramName = p.getName();
        const paramType = p.getType();
        const isOptional = p.hasQuestionToken();
        const isRest = p.isRestParameter();

        let paramStr = isRest ? `...${paramName}` : paramName;
        if (isOptional) paramStr += '?';
        paramStr += `: ${this.cleanImportPath(paramType.getText())}`;

        return paramStr;
      });

      sig += `(${paramStrs.join(', ')}): ${this.cleanImportPath(returnType.getText())}`;
      return sig;
    } else if (declaration.isKind(SyntaxKind.VariableDeclaration)) {
      const name = declaration.getName();
      const type = declaration.getType();
      return `const ${name}: ${this.cleanImportPath(type.getText())}`;
    } else if (
      declaration.isKind(SyntaxKind.TypeAliasDeclaration) ||
      declaration.isKind(SyntaxKind.InterfaceDeclaration) ||
      declaration.isKind(SyntaxKind.EnumDeclaration)
    ) {
      const text = declaration.getText();
      return text.replace(/^export\s+/, '');
    } else if (declaration.isKind(SyntaxKind.ClassDeclaration)) {
      const name = declaration.getName();
      let classStr = `class ${name}`;

      const typeParams = declaration.getTypeParameters();
      if (typeParams && typeParams.length > 0) {
        classStr += `<${typeParams.map((tp) => tp.getText()).join(', ')}>`;
      }

      const extendsClause = declaration.getExtends();
      if (extendsClause) {
        classStr += ` extends ${extendsClause.getText()}`;
      }

      const implementsClauses = declaration.getImplements();
      if (implementsClauses && implementsClauses.length > 0) {
        classStr += ` implements ${implementsClauses.map((i) => i.getText()).join(', ')}`;
      }

      classStr += ' { ... }';
      return classStr;
    }

    const text = declaration.getText();
    return text.replace(/^export\s+/, '');
  }

  /**
   * Simplify a function signature
   */
  private simplifySignature(
    sig: import('ts-morph').Signature,
    maxDepth: number,
    visitedTypes: Set<string>
  ): { params: Record<string, unknown>; return: unknown } {
    const params: Record<string, unknown> = {};
    const parameters = sig.getParameters();

    // Check if this is a destructured parameter
    if (parameters.length === 1) {
      const param = parameters[0];
      const paramName = param.getName();

      if (paramName.includes('{') || paramName.includes('[') || paramName.startsWith('__')) {
        const paramType = param.getTypeAtLocation(param.getValueDeclaration()!);

        if (paramType.isObject() && paramType.getProperties().length > 0) {
          paramType.getProperties().forEach((prop) => {
            try {
              const propName = prop.getName();
              const propDecl = prop.getValueDeclaration();
              if (propDecl) {
                const propType = prop.getTypeAtLocation(propDecl);
                const isOptional = this.hasOptionalToken(propDecl);
                const resolvedType = this.simplifyType(propType, maxDepth, visitedTypes);
                params[propName + (isOptional ? '?' : '')] = resolvedType;
              }
            } catch {
              // Skip properties that cause errors
            }
          });
        } else {
          params['...args'] = this.simplifyType(paramType, maxDepth, visitedTypes);
        }
      } else {
        params[paramName] = this.simplifyType(
          param.getTypeAtLocation(param.getValueDeclaration()!),
          maxDepth,
          visitedTypes
        );
      }
    } else if (parameters.length > 1) {
      parameters.forEach((param) => {
        const paramName = param.getName();
        const paramType = param.getTypeAtLocation(param.getValueDeclaration()!);
        params[paramName] = this.simplifyType(paramType, maxDepth, visitedTypes);
      });
    }

    const returnType = sig.getReturnType();
    return {
      params: params,
      return: this.simplifyType(returnType, maxDepth, visitedTypes)
    };
  }

  /**
   * Recursively simplify a type
   */
  private simplifyType(type: import('ts-morph').Type, maxDepth: number, visitedTypes: Set<string>, depth = 0): unknown {
    if (depth >= maxDepth) {
      return '...';
    }

    const typeText = type.getText();

    // Check for circular references
    if (visitedTypes.has(typeText) && depth > 0) {
      const symbol = type.getSymbol();
      if (symbol) {
        const name = symbol.getName();
        if (name && name !== '__type') {
          return name;
        }
      }
      return typeText;
    }
    visitedTypes.add(typeText);

    // Handle primitives and built-in types
    const primitiveTypes = [
      'string',
      'number',
      'boolean',
      'bigint',
      'symbol',
      'null',
      'undefined',
      'void',
      'any',
      'unknown',
      'never'
    ];
    const builtinTypes = ['Date', 'RegExp', 'Error', 'Function'];
    if (primitiveTypes.includes(typeText) || builtinTypes.includes(typeText)) {
      return typeText;
    }

    // Handle string/number/boolean literals
    if (
      (typeText.startsWith('"') && typeText.endsWith('"')) ||
      /^-?\d+$/.test(typeText) ||
      typeText === 'true' ||
      typeText === 'false'
    ) {
      return typeText;
    }

    // Handle arrays
    if (type.isArray()) {
      const elementType = type.getArrayElementType();
      return `${String(this.simplifyType(elementType!, maxDepth, visitedTypes, depth + 1))}[]`;
    }

    // Handle tuples
    if (type.isTuple()) {
      const elements = type.getTupleElements();
      return `[${elements.map((e) => this.simplifyType(e, maxDepth, visitedTypes, depth + 1)).join(', ')}]`;
    }

    // Handle function types
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length > 0 && !type.isObject()) {
      const sig = callSignatures[0];
      const params = sig.getParameters().map((p) => {
        const paramType = p.getTypeAtLocation(p.getValueDeclaration()!);
        return `${p.getName()}: ${String(this.simplifyType(paramType, maxDepth, visitedTypes, depth + 1))}`;
      });
      const returnType = sig.getReturnType();
      return `(${params.join(', ')}) => ${String(this.simplifyType(returnType, maxDepth, visitedTypes, depth + 1))}`;
    }

    // Handle union types
    if (type.isUnion()) {
      const unionTypes = type.getUnionTypes();
      return unionTypes.map((ut) => this.simplifyType(ut, maxDepth, visitedTypes, depth + 1)).join(' | ');
    }

    // Handle intersection types
    if (type.isIntersection()) {
      const parts = type.getIntersectionTypes().map((it) => this.simplifyType(it, maxDepth, visitedTypes, depth + 1));
      return parts.join(' & ');
    }

    // Handle object types
    const objSymbol = type.getSymbol();
    if (objSymbol && type.isObject()) {
      const properties = type.getProperties();

      if (properties.length === 0) {
        return {};
      }

      const typeName = objSymbol.getName();
      if (typeName && typeName !== '__type') {
        // For complex types with many properties, just return the name
        if (properties.length > 10 && depth >= 2) {
          return typeName;
        }
      }

      const propObj: Record<string, unknown> = {};
      const propsToShow = properties.slice(0, 20);

      propsToShow.forEach((prop) => {
        try {
          const propName = prop.getName();
          const propDecl = prop.getValueDeclaration();
          if (!propDecl) return;

          const propType = prop.getTypeAtLocation(propDecl);
          const isOptional = this.hasOptionalToken(propDecl);

          const resolvedType = this.simplifyType(propType, maxDepth, visitedTypes, depth + 1);
          propObj[propName + (isOptional ? '?' : '')] = resolvedType;
        } catch {
          // Skip properties that cause errors
        }
      });

      if (properties.length > 20) {
        propObj['...'] = '...';
      }

      return propObj;
    }

    return this.cleanImportPath(typeText);
  }

  /**
   * Clean import paths from type text
   */
  private cleanImportPath(typeText: string): string {
    let cleaned = typeText.replace(/import\("[^"]+"\)\./g, '');

    // Apply common type simplifications
    cleaned = cleaned
      .replace(/ZodObject<[^>]+>/g, 'ZodObject')
      .replace(/ZodArray<[^>]+>/g, 'ZodArray')
      .replace(/ZodOptional<[^>]+>/g, 'ZodOptional')
      .replace(/ZodDefault<[^>]+>/g, 'ZodDefault')
      .replace(/ZodType<[^>]+>/g, 'ZodType')
      .replace(/Server<[^>]*ClientToServerEvents[^>]*>/g, 'SocketIOServer')
      .replace(/Server<[^>]*DefaultEventsMap[^>]*>/g, 'SocketIOServer')
      .replace(/Socket<[^>]*DefaultEventsMap[^>]*>/g, 'SocketIOSocket')
      .replace(/Sql<[^>]*PostgresType[^>]*>/g, 'PostgresConnection')
      .replace(/TransactionSql<[^>]*PostgresType[^>]*>/g, 'PostgresTransactionConnection');

    return cleaned;
  }

  /**
   * Resolve an npm package to its type definition file
   */
  private resolveNpmPackage(packageName: string, basePath: string): string | null {
    // First try to resolve as a workspace package
    const workspaceResult = this.resolveWorkspacePackage(packageName, basePath);
    if (workspaceResult) {
      return workspaceResult;
    }

    // Extract main package name and subpath
    const parts = packageName.split('/');
    let mainPackageName = packageName;
    let subPath = '';

    if (parts[0].startsWith('@')) {
      mainPackageName = parts.slice(0, 2).join('/');
      subPath = parts.slice(2).join('/');
    } else if (parts.length > 1) {
      mainPackageName = parts[0];
      subPath = parts.slice(1).join('/');
    }

    // Try to find package.json manually
    let currentPath = basePath;
    let packageDir: string | null = null;

    while (currentPath !== '/') {
      const testPath = path.join(currentPath, 'node_modules', mainPackageName);
      if (fs.existsSync(path.join(testPath, 'package.json'))) {
        packageDir = testPath;
        break;
      }
      currentPath = path.dirname(currentPath);
    }

    if (!packageDir) {
      return null;
    }

    const packageJsonPath = path.join(packageDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as Record<string, unknown>;

    // If there's a subpath, try to resolve it
    if (subPath) {
      const subPathLocations = [
        path.join(packageDir, 'dist', subPath + '.d.ts'),
        path.join(packageDir, 'dist', subPath, 'index.d.ts'),
        path.join(packageDir, subPath + '.d.ts'),
        path.join(packageDir, subPath, 'index.d.ts'),
        path.join(packageDir, 'lib', subPath + '.d.ts'),
        path.join(packageDir, 'lib', subPath, 'index.d.ts')
      ];

      for (const location of subPathLocations) {
        if (fs.existsSync(location)) {
          return location;
        }
      }

      return null;
    }

    // Look for types field in package.json
    if (packageJson.types || packageJson.typings) {
      const typesPath = path.join(packageDir, (packageJson.types as string) || (packageJson.typings as string));
      if (fs.existsSync(typesPath)) {
        return typesPath;
      }
    }

    return null;
  }

  /**
   * Resolve a workspace package to its type definition file
   */
  private resolveWorkspacePackage(packageName: string, basePath: string): string | null {
    const rootPackageJsonPath = path.join(basePath, '..', '..', 'package.json');
    if (!fs.existsSync(rootPackageJsonPath)) {
      return null;
    }

    const rootPackageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf-8')) as Record<string, unknown>;
    if (!rootPackageJson.workspaces) {
      return null;
    }

    // Extract the package name and subpath
    const parts = packageName.split('/');
    let mainPackageName = packageName;
    let subPath = '';

    if (parts[0].startsWith('@')) {
      mainPackageName = parts.slice(0, 2).join('/');
      subPath = parts.slice(2).join('/');
    } else if (parts.length > 1) {
      mainPackageName = parts[0];
      subPath = parts.slice(1).join('/');
    }

    // Search for workspace package
    const workspaces = Array.isArray(rootPackageJson.workspaces)
      ? rootPackageJson.workspaces
      : (rootPackageJson.workspaces as Record<string, string[]>).packages || [];

    for (const workspace of workspaces) {
      const workspacePattern = (workspace as string).replace('/*', '');
      const workspacePath = path.join(basePath, '..', '..', workspacePattern);

      if (fs.existsSync(workspacePath) && fs.statSync(workspacePath).isDirectory()) {
        const dirs = (workspace as string).includes('*')
          ? fs.readdirSync(workspacePath).map((d) => path.join(workspacePath, d))
          : [workspacePath];

        for (const dir of dirs) {
          if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;

          const pkgJsonPath = path.join(dir, 'package.json');
          if (fs.existsSync(pkgJsonPath)) {
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) as Record<string, unknown>;
            if (pkgJson.name === mainPackageName) {
              // Found the workspace package
              if (subPath) {
                // Handle subpath exports
                const subPathLocations = [
                  path.join(dir, 'build', 'types', 'src', subPath + '.d.ts'),
                  path.join(dir, 'build', 'types', 'src', subPath, 'index.d.ts'),
                  path.join(dir, 'build', 'dist', 'src', subPath + '.d.ts'),
                  path.join(dir, 'dist', subPath + '.d.ts'),
                  path.join(dir, 'dist', subPath, 'index.d.ts'),
                  path.join(dir, subPath + '.d.ts'),
                  path.join(dir, subPath, 'index.d.ts'),
                  path.join(dir, 'src', subPath + '.ts'),
                  path.join(dir, 'src', subPath, 'index.ts')
                ];

                for (const location of subPathLocations) {
                  if (fs.existsSync(location)) {
                    return location;
                  }
                }
              } else {
                // No subpath, use main export
                const typesField = (pkgJson.types as string) || (pkgJson.typings as string);
                if (typesField) {
                  const resolvedPath = path.join(dir, typesField);
                  if (fs.existsSync(resolvedPath)) {
                    return resolvedPath;
                  }
                }

                // Try common locations
                const commonLocations = [
                  path.join(dir, 'build', 'types', 'src', 'index.d.ts'),
                  path.join(dir, 'build', 'dist', 'src', 'index.d.ts'),
                  path.join(dir, 'dist', 'index.d.ts'),
                  path.join(dir, 'index.d.ts'),
                  path.join(dir, 'src', 'index.ts'),
                  path.join(dir, 'src', 'index.d.ts')
                ];

                for (const location of commonLocations) {
                  if (fs.existsSync(location)) {
                    return location;
                  }
                }
              }

              return null;
            }
          }
        }
      }
    }

    return null;
  }
}
