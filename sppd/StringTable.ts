import { Demo } from "./Demo.ts";
import { EntityProperty, EntityBaseLine } from "./Entity.ts";

export class StringTableEntry {

  public tableName: string;
  public entryName: string;
  constructor (tableName: string, entryName: string) {
    this.tableName = tableName;
    this.entryName = entryName;
  }

  static fromDemo (tableName: string, entryName: string, demo: Demo, compression?: number | null) {
    switch (tableName) {
      case "userinfo": return new PlayerInfo(tableName, entryName, demo, compression);
      case "server_query_info": return new QueryPort(tableName, entryName, demo, compression);
      case "instancebaseline": return new InstanceBaseLine(tableName, entryName, demo, compression);
      case "GameRulesCreation": return new StringEntryData(tableName, entryName, demo, compression);
      case "InfoPanel": return new StringEntryData(tableName, entryName, demo, compression);
      case "lightstyles": return new LightStyle(tableName, entryName, demo, compression);
      case "modelprecache": return new PrecacheData(tableName, entryName, demo, compression);
      case "genericprecache": return new PrecacheData(tableName, entryName, demo, compression);
      case "soundprecache": return new PrecacheData(tableName, entryName, demo, compression);
      case "decalprecache": return new PrecacheData(tableName, entryName, demo, compression);
      default: return new StringTableEntry(tableName, entryName);
    }
  }

}

export class PlayerInfo extends StringTableEntry {
  public steamID: BigInt;
  public userID: number;
  public GUID: string;
  public friendsID: number;
  public friendsName: string;
  public fakePlayer: boolean;
  public isHLTV: boolean;
  public customFilesCRC: number[];
  public filesDownloaded: number;
  constructor (tableName: string, entryName: string, demo: Demo, compression?: number | null) {
    super(tableName, entryName);
    const steamIDBuffer = demo.buf.nextBytes(64).buffer;
    this.steamID = new DataView(steamIDBuffer).getBigUint64(0);
    this.userID = demo.buf.nextInt(32);
    this.GUID = demo.buf.nextTrimmedString(33);
    demo.buf.nextInt(3);
    this.friendsID = demo.buf.nextInt(32);
    this.friendsName = demo.buf.nextTrimmedString(33);
    this.fakePlayer = !!demo.buf.nextBit();
    this.isHLTV = !!demo.buf.nextBit();
    demo.buf.nextInt(2);
    this.customFilesCRC = [];
    for (let i = 0; i < 4; i ++) {
      this.customFilesCRC.push(demo.buf.nextInt(32));
    }
    this.filesDownloaded = demo.buf.nextByte();
  }
}

export class QueryPort extends StringTableEntry {
  public port: number;
  constructor (tableName: string, entryName: string, demo: Demo, compression?: number | null) {
    super(tableName, entryName);
    this.port = demo.buf.nextInt(32);
  }
}

export class InstanceBaseLine extends StringTableEntry {
  public entityProperties?: EntityProperty[];
  constructor (tableName: string, entryName: string, demo: Demo, compression?: number | null) {
    super(tableName, entryName);

    if (demo.parserClasses === null) {
      console.warn("Received InstanceBaseLine before DataTables.");
      return;
    }

    const index = parseInt(entryName);
    if (isNaN(index) || index < 0 || index >= demo.parserClasses.length) {
      throw `Name "${entryName}" is not a valid server class index.`;
    }

    const parserClass = demo.parserClasses[index];
    if (!parserClass) {
      throw `Could not find parsed entity class at index ${index}.`;
    }
    const { serverClass, flatProperties } = parserClass;

    this.entityProperties = EntityProperty.readProperties(demo, flatProperties);
    EntityBaseLine.updateBaseLine(demo, serverClass, this.entityProperties, flatProperties.length);

  }
}

export class StringEntryData extends StringTableEntry {
  public string: string;
  constructor (tableName: string, entryName: string, demo: Demo, compression?: number | null) {
    super(tableName, entryName);
    this.string = demo.buf.nextNullTerminatedString();
  }
}

export class LightStyle extends StringTableEntry {
  public data: string;
  constructor (tableName: string, entryName: string, demo: Demo, compression?: number | null) {
    super(tableName, entryName);
    this.data = demo.buf.nextNullTerminatedString();
  }
}

export class PrecacheData extends StringTableEntry {
  public flags: number;
  constructor (tableName: string, entryName: string, demo: Demo, compression?: number | null) {
    super(tableName, entryName);
    this.flags = demo.buf.nextInt(2);
  }
}

export class StringTableClass {
  public name: string;
  public data?: string;
  constructor (demo: Demo) {
    this.name = demo.buf.nextNullTerminatedString();
    const hasData = !!demo.buf.nextBit();
    if (hasData) {
      const length = demo.buf.nextInt(16);
      this.data = demo.buf.nextString(length);
    }
  }
}

export class StringTable {

  public name: string;
  public entries: StringTableEntry[] = [];
  public classes: StringTableClass[] = [];
  public maxEntries?: number;
  public userDataSize: number = 0;
  public userDataSizeBits: number = 0;

  constructor (name: string) {
    this.name = name;
  }

  static fromDemo (demo: Demo) {
    const tableName = demo.buf.nextNullTerminatedString();

    let table = demo.stringTables.get(tableName);
    if (!table) {
      console.warn(`Got StringTables message for "${tableName}" before SvcCreateStringTable.`);
      table = new StringTable(tableName);
    }

    const entryCount = demo.buf.nextInt(16);
    for (let i = 0; i < entryCount; i ++) {
      const entryName = demo.buf.nextNullTerminatedString();
      const entryHasData = !!demo.buf.nextBit();
      if (entryHasData) {
        const dataLength = demo.buf.nextInt(16) * 8;
        const dataEnd = demo.buf.cursor + dataLength;
        table.entries.push(StringTableEntry.fromDemo(tableName, entryName, demo, null));
        demo.buf.cursor = dataEnd;
      } else {
        table.entries.push(new StringTableEntry(tableName, entryName));
      }
    }

    const hasClasses = !!demo.buf.nextBit();
    if (hasClasses) {
      const classCount = demo.buf.nextInt(16);
      for (let i = 0; i < classCount; i ++) {
        table.classes.push(new StringTableClass(demo));
      }
    }

    return table;
  }

}
