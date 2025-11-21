import * as ts from 'typescript';

export function tsStringIsEqual(received: string, expected: string): boolean {
  // Parse strings into SourceFile objects
  const receivedSourceFile = ts.createSourceFile('received.ts', `type X = ${received}`, ts.ScriptTarget.Latest, true);
  const expectedSourceFile = ts.createSourceFile('expected.ts', `type X = ${expected}`, ts.ScriptTarget.Latest, true);

  // Function to find the first TypeAliasDeclaration in a SourceFile
  function getTypeAliasDeclaration(sourceFile: ts.SourceFile): ts.TypeAliasDeclaration | undefined {
    for (const statement of sourceFile.statements) {
      if (ts.isTypeAliasDeclaration(statement)) {
        return statement;
      }
    }
    return undefined;
  }

  const receivedTypeAlias = getTypeAliasDeclaration(receivedSourceFile);
  const expectedTypeAlias = getTypeAliasDeclaration(expectedSourceFile);

  if (!receivedTypeAlias || !expectedTypeAlias) {
    return false;
  }

  // Compare the type alias names
  const receivedName = receivedTypeAlias.name.getText();
  const expectedName = expectedTypeAlias.name.getText();

  if (receivedName !== expectedName) {
    return false;
  }

  // Custom CompilerHost to use in-memory source files
  const sourceFiles: { [fileName: string]: ts.SourceFile } = {
    'received.ts': receivedSourceFile,
    'expected.ts': expectedSourceFile
  };

  const compilerHost: ts.CompilerHost = {
    getSourceFile: (fileName, languageVersion) => sourceFiles[fileName],
    writeFile: () => {},
    getDefaultLibFileName: () => 'lib.d.ts',
    useCaseSensitiveFileNames: () => false,
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => '',
    getNewLine: () => '\n',
    fileExists: (fileName) => !!sourceFiles[fileName],
    readFile: (fileName) => '',
    directoryExists: () => true,
    getDirectories: () => []
  };

  // Create the TypeScript program
  const program = ts.createProgram(['received.ts', 'expected.ts'], {}, compilerHost);
  const checker = program.getTypeChecker();

  // Get types from type nodes
  const receivedType = checker.getTypeFromTypeNode(receivedTypeAlias.type);
  const expectedType = checker.getTypeFromTypeNode(expectedTypeAlias.type);

  // Compare the types by converting them to strings
  const receivedTypeString = checker.typeToString(receivedType);
  const expectedTypeString = checker.typeToString(expectedType);

  return receivedTypeString === expectedTypeString;
}
