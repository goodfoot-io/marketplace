declare module 'dependency-tree' {
  interface DependencyTreeOptions {
    filename: string;
    directory?: string;
    filter?: (path: string) => boolean;
    nonExistent?: string[];
    noTypeDefinitions?: boolean;
    tsConfig?: string;
    webpackConfig?: string;
    nodeModulesConfig?: unknown;
    detective?: unknown;
    visited?: Record<string, boolean>;
    isListForm?: boolean;
  }

  interface DependencyTree {
    toList(options: DependencyTreeOptions): string[];
    [key: string]: unknown;
  }

  const dependencyTree: DependencyTree;
  export default dependencyTree;
}
