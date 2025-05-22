declare module "@thatopen/components" {
  export class Components {
    constructor();
    init(): void;
    get<T>(cls: new (...args: any[]) => T): T;
  }

  export type RelationsMap = Map<number, Map<number, number[]>>;

  export class IfcRelationsIndexer {
    static readonly uuid: string;
    relationMaps: Record<string, RelationsMap>;
    process(model: any, config?: any): Promise<RelationsMap>;
    processFromWebIfc(api: any, modelID: number): Promise<RelationsMap>;
    getEntityRelations(
      model: string | RelationsMap | any,
      expressID: number,
      attribute: string
    ): number[];
  }
}
