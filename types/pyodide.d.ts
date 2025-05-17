declare module "pyodide" {
  export interface PyProxy {
    toJs(options?: { dict_converter?: (data: any) => any }): any;
    destroy(): void;
  }

  export interface PyodideInterface {
    runPython(code: string): any;
    loadPackage(names: string | string[]): Promise<void>;
    pyimport(name: string): any;
    globals: any;
  }
}
