import { Demo } from "./Demo.ts";

export enum DataTablePropertyType {
  Int = 0,
  Float = 1,
  Vector3 = 2,
  Vector2 = 3,
  String = 4,
  Array = 5,
  DataTable = 6
}

export enum DataTablePropertyFlag {
  Unsigned = 0,
  Coord = 1,
  NoScale = 2,
  RoundDown = 3,
  RoundUp = 4,
  Normal = 5,
  Exclude = 6,
  Xyze = 7,
  InsideArray = 8,
  ProxyAlwaysYes = 9,
  IsVectorElem = 10,
  Collapsible = 11,
  CoordMp = 12,
  CoordMpLp = 13,
  CoordMpInt = 14,
  CellCoord = 15,
  CellCoordLp = 16,
  CellCoordInt = 17,
  ChangesOften = 18
}

export class DataTableProperty {

  public type: number;
  public name: string;
  public flags: number;
  public priority: number;
  public excludeName?: string;
  public value?: {low: number, high: number, bits: number};
  public arrayElements?: number;

  constructor (demo: Demo) {
    this.type = demo.buf.nextInt(5);
    this.name = demo.buf.nextNullTerminatedString();
    this.flags = demo.buf.nextInt(19);
    this.priority = demo.buf.nextByte();
    const exclude = this.hasFlag(DataTablePropertyFlag.Exclude);
    if (this.type === DataTablePropertyType.DataTable || exclude) {
      this.excludeName = demo.buf.nextNullTerminatedString();
    } else {
      switch (this.type) {
        case DataTablePropertyType.Int:
        case DataTablePropertyType.Float:
        case DataTablePropertyType.Vector2:
        case DataTablePropertyType.Vector3:
        case DataTablePropertyType.String:
          this.value = {
            low: demo.buf.nextFloat(),
            high: demo.buf.nextFloat(),
            bits: demo.buf.nextInt(7)
          };
          break;
        case DataTablePropertyType.Array:
          this.arrayElements = demo.buf.nextInt(10);
          break;
        default:
          throw `Unsupported DataTable property type: ${this.type}.`;
      }
    }
  }

  hasFlag (flag: number): boolean {
    return (this.flags & (1 << flag)) !== 0;
  }

}
export class DataTable {
  public needsDecoder: boolean;
  public name: string;
  public properties: DataTableProperty[] = [];
  constructor (demo: Demo) {
    this.needsDecoder = !!demo.buf.nextBit();
    this.name = demo.buf.nextNullTerminatedString();
    const propertiesCount = demo.buf.nextInt(10);
    for (let i = 0; i < propertiesCount; i ++) {
      this.properties.push(new DataTableProperty(demo));
    }
  }
}

export class ServerClass {
  public tableID: number;
  public className: string;
  public tableName: string;
  constructor (tableID: number, className: string, tableName: string) {
    this.tableID = tableID;
    this.className = className;
    this.tableName = tableName;
  }
}

export class FlatProperty {
  public name: string;
  public baseProperty: DataTableProperty;
  public baseArrayProperty?: DataTableProperty;
  constructor (name: string, baseProperty: DataTableProperty, baseArrayProperty?: DataTableProperty) {
    this.name = name;
    this.baseProperty = baseProperty;
    this.baseArrayProperty = baseArrayProperty;
  }
}

class ExcludePair {
  public from: string;
  public exclude: string;
  constructor (from: string, exclude: string) {
    this.from = from;
    this.exclude = exclude;
  }
}
class ExcludePairSet {
  public elements: ExcludePair[] = [];
  has (element: ExcludePair, max?: number): boolean {
    if (!max) max = this.elements.length;
    for (let i = 0; i < max; i ++) {
      const curr = this.elements[i];
      if (
        curr &&
        curr.from === element.from &&
        curr.exclude === element.exclude
      ) return true;
    }
    return false;
  }
  add (newElement: ExcludePair): void {
    if (!this.has(newElement)) {
      this.elements.push(newElement);
    }
  }
  union (other: ExcludePairSet): void {
    const max = this.elements.length;
    for (const element of other.elements) {
      if (this.has(element, max)) continue;
      this.elements.push(element);
    }
  }
}

export class ParserClass {

  public serverClass: ServerClass;
  public flatProperties: FlatProperty[];

  constructor (serverClass: ServerClass, flatProperties: FlatProperty[]) {
    this.serverClass = serverClass;
    this.flatProperties = flatProperties;
  }

  static fromDemo (demo: Demo): ParserClass[] {
    const parsedTable: ParserClass[] = [];

    if (
      demo.state.dataTables === null
      || demo.state.serverClasses === null
    ) {
      throw "Tried to parse DataTables before they were received.";
    }

    for (const serverClass of demo.state.serverClasses) {
      const tableID = serverClass.tableID;
      const table = demo.state.dataTables[tableID];
      if (!table) {
        console.warn(`Missing DataTable of server class "${serverClass.className}".`);
        continue;
      }
      const excludes = ParserClass.gatherExcludes(demo, table);
      ParserClass.gatherProperties(demo, parsedTable, excludes, table, serverClass);
      const parserClass = parsedTable[tableID];
      if (!parserClass) {
        console.warn(`Missing ParserClass of "${serverClass.className}".`);
        continue;
      }
      ParserClass.sortProperties(parserClass.flatProperties);
    }

    return parsedTable;
  }

  static gatherExcludes (demo: Demo, table: DataTable): ExcludePairSet {
    const excludes = new ExcludePairSet();

    if (demo.state.dataTables === null) {
      throw "Tried to parse DataTables before they were received.";
    }

    for (const property of table.properties) {
      if (typeof property.excludeName === "undefined") continue;
      if (property.type === DataTablePropertyType.DataTable) {
        const excludeTable = demo.state.dataTables.find(c => c.name === property.excludeName);
        if (!excludeTable) {
          console.warn(`Missing excluded table "${property.excludeName}" for table "${table.name}"`);
          continue;
        }
        excludes.union(ParserClass.gatherExcludes(demo, excludeTable));
      } else if (property.hasFlag(DataTablePropertyFlag.Exclude)) {
        excludes.add(new ExcludePair(property.excludeName, property.name));
      }
    }

    return excludes;
  }

  static gatherProperties (
    demo: Demo,
    parsedTable: ParserClass[],
    excludes: ExcludePairSet,
    table: DataTable,
    serverClass: ServerClass,
    prefix: string = ""
  ): void {

    const flatProperties: FlatProperty[] = [];
    ParserClass.iterateProperties(demo, parsedTable, excludes, table, serverClass, flatProperties, prefix);
    if (serverClass.tableID === parsedTable.length) {
      const lookup = new ParserClass(serverClass, []);
      parsedTable.push(lookup);
    }
    const parserClass = parsedTable[serverClass.tableID];
    if (!parserClass) {
      console.warn(`Missing ParserClass of "${serverClass.className}".`);
      return;
    }
    parserClass.flatProperties.push(...flatProperties);

  }

  static iterateProperties (
    demo: Demo,
    parsedTable: ParserClass[],
    excludes: ExcludePairSet,
    table: DataTable,
    serverClass: ServerClass,
    flatProperties: FlatProperty[],
    prefix: string
  ): void {
    if (demo.state.dataTables === null) {
      throw "Tried to parse DataTables before they were received.";
    }

    for (let i = 0; i < table.properties.length; i ++) {

      const property = table.properties[i];
      if (
        !property
        || property.hasFlag(DataTablePropertyFlag.Exclude)
        || property.hasFlag(DataTablePropertyFlag.InsideArray)
        || excludes.has(new ExcludePair(table.name, property.name))
      ) continue;

      if (property.type === DataTablePropertyType.DataTable) {

        const excludeTable = demo.state.dataTables.find(c => c.name === property.excludeName);
        if (!excludeTable) {
          console.warn(`Missing excluded table "${property.excludeName}" for table "${table.name}".`);
          continue;
        }
        if (property.hasFlag(DataTablePropertyFlag.Collapsible)) {
          ParserClass.iterateProperties(demo, parsedTable, excludes, excludeTable, serverClass, flatProperties, prefix);
        } else {
          const newPrefix = property.name.length > 0 ? property.name + "." : "";
          ParserClass.gatherProperties(demo, parsedTable, excludes, excludeTable, serverClass, newPrefix);
        }

      } else {

        const prefixedName = prefix + property.name;
        let newProperty;
        if (property.type !== DataTablePropertyType.Array) {
          newProperty = new FlatProperty(prefixedName, property);
        } else {
          if (!table.properties[i - 1]) {
            console.warn(`Found array element without array at i = ${i}, ignoring.`);
            continue;
          }
          newProperty = new FlatProperty(prefixedName, property, table.properties[i - 1]);
        }
        flatProperties.push(newProperty);

      }

    }
  }

  static sortProperties (flatProperties: FlatProperty[]): void {

    const priorities = flatProperties.map(entry => entry.baseProperty.priority);
    priorities.push(64);
    priorities.sort((a, b) => a - b);
    const prioritySet = new Set(priorities);

    let start = 0;
    for (const priority of prioritySet) {
      for (let i = start; i < flatProperties.length; i ++) {
        const flatProperty = flatProperties[i];
        if (!flatProperty) {
          console.warn(`Unexpected gap in property list at i = ${i}.`);
          continue;
        }
        const baseProperty = flatProperty.baseProperty;
        if (
          baseProperty.priority !== priority
          && !(baseProperty.hasFlag(DataTablePropertyFlag.ChangesOften) && priority === 64)
        ) continue;
        if (start !== i) {
          const other = flatProperties[start];
          if (!other) {
            console.warn(`Unexpected gap in property list at i = ${start}.`);
            continue;
          }
          flatProperties[i] = other;
          flatProperties[start] = flatProperty;
        }
        start ++;
      }
    }

  }

}
