import { Demo } from "./Demo.ts";
import { DemoBuffer } from "./DemoBuffer.ts";
import { Vector } from "./Vector.ts";
import { Message } from "./Message.ts";
import { ServerClass } from "./DataTable.ts";
import {
  Entity,
  Entities,
  EntityProperty,
  EntityUpdate,
  EntityDelta,
  EntityEnterPVS,
  EntityLeavePVS
} from "./Entity.ts";
import { StringTable, StringTableEntry } from "./StringTable.ts";

export class NetSvcMessage {

  static fromID (type: number, demo: Demo): NetSvcMessage | undefined {

    switch (type) {
      case 0: return new NetNop();
      case 1: return new NetDisconnect(demo);
      case 2: return new NetFile(demo);
      case 3: return new NetSplitScreenUser(demo);
      case 4: return new NetTick(demo);
      case 5: return new NetStringCmd(demo);
      case 6: return new NetSetConVar(demo);
      case 7: return new NetSignonState(demo);
      case 8: return new SvcServerInfo(demo);
      case 9: return new SvcSendTable(demo);
      case 10: return new SvcClassInfo(demo);
      case 11: return new SvcSetPause(demo);
      case 12: return new SvcCreateStringTable(demo);
      case 13: return new SvcUpdateStringTable(demo);
      case 14: return new SvcVoiceInit(demo);
      case 15: return new SvcVoiceData(demo);
      case 16: return new SvcPrint(demo);
      case 17: return new SvcSounds(demo);
      case 18: return new SvcSetView(demo);
      case 19: return new SvcFixAngle(demo);
      case 20: return new SvcCrosshairAngle(demo);
      case 21: return new SvcBspDecal(demo);
      case 22: return new SvcSplitScreen(demo);
      case 23: return new SvcUserMessage(demo);
      case 24: return new SvcEntityMessage(demo);
      case 25: return new SvcGameEvent(demo);
      case 26: return new SvcPacketEntities(demo);
      case 27: return new SvcTempEntities(demo);
      case 28: return new SvcPrefetch(demo);
      case 29: return new SvcMenu(demo);
      case 30: return new SvcGameEventList(demo);
      case 31: return new SvcGetCvarValue(demo);
      case 32: return new SvcCmdKeyValues(demo);
      case 33: return new SvcPaintmapData(demo);

      default: throw `Unknown Net/Svc message, ID ${type}.`;
    }

  }

}

export class NetNop extends NetSvcMessage {
}

export class NetDisconnect extends NetSvcMessage {
  public message: string;
  constructor (demo: Demo) {
    super();
    this.message = demo.buf.nextNullTerminatedString();
  }
}

export class NetFile extends NetSvcMessage {
  public transferID: number;
  public fileName: string;
  public fileRequested: boolean;
  constructor (demo: Demo) {
    super();
    this.transferID = demo.buf.nextInt(32);
    this.fileName = demo.buf.nextNullTerminatedString();
    this.fileRequested = !!demo.buf.nextBit();
  }
}

export class NetSplitScreenUser extends NetSvcMessage {
  public bool: boolean;
  constructor (demo: Demo) {
    super();
    this.bool = !!demo.buf.nextBit();
  }
}

export class NetTick extends NetSvcMessage {
  public tick: number;
  public hostFrameTime: number;
  public hostFrameTimeStdDeviation: number;
  constructor (demo: Demo) {
    super();
    this.tick = demo.buf.nextInt(32);
    this.hostFrameTime = demo.buf.nextInt(16) / 1e5;
    this.hostFrameTimeStdDeviation = demo.buf.nextInt(16) / 1e5;
    demo.state.tick = this.tick;
  }
}

export class NetStringCmd extends NetSvcMessage {
  public command: string;
  constructor (demo: Demo) {
    super();
    this.command = demo.buf.nextNullTerminatedString();
  }
}

class ConVar {
  name: string;
  value: string;
  constructor (name: string, value: string) {
    this.name = name;
    this.value = value;
  }
}
export class NetSetConVar extends NetSvcMessage {
  public convars: ConVar[] = [];
  constructor (demo: Demo) {
    super();
    const length = demo.buf.nextByte();
    for (let i = 0; i < length; i ++) {
      const name = demo.buf.nextNullTerminatedString();
      const value = demo.buf.nextNullTerminatedString();
      this.convars.push(new ConVar(name, value));
    }
  }
}

export class NetSignonState extends NetSvcMessage {
  public signonState: number;
  public spawnCount: number;
  public serverPlayerCount: number;
  public playerNetworkIDs: number[] = [];
  public mapName: string;
  constructor (demo: Demo) {
    super();
    this.signonState = demo.buf.nextByte();
    this.spawnCount = demo.buf.nextSignedInt(32);
    this.serverPlayerCount = demo.buf.nextInt(32);
    const idsLength = demo.buf.nextInt(32);
    for (let i = 0; i < idsLength; i ++) {
      const id = demo.buf.nextByte();
      this.playerNetworkIDs.push(id);
    }
    const mapNameLength = demo.buf.nextInt(32);
    this.mapName = demo.buf.nextTrimmedString(mapNameLength * 8);
  }
}

export class SvcServerInfo extends NetSvcMessage {
  public protocol: number;
  public serverCount: number;
  public isHLTV: boolean;
  public isDedicated: boolean;
  public clientCRC: number;
  public maxClasses: number;
  public mapCRC: number;
  public playerSlot: number;
  public maxClients: number;
  public _unknown: Uint8Array;
  public tickInterval: number;
  public serverOS: string;
  public gameDirectory: string;
  public mapName: string;
  public skyName: string;
  public hostName: string;
  constructor (demo: Demo) {
    super();
    this.protocol = demo.buf.nextInt(16);
    this.serverCount = demo.buf.nextInt(32);
    this.isHLTV = !!demo.buf.nextBit();
    this.isDedicated = !!demo.buf.nextBit();
    this.clientCRC = demo.buf.nextInt(32);
    this.maxClasses = demo.buf.nextInt(16);
    this.mapCRC = demo.buf.nextInt(32);
    this.playerSlot = demo.buf.nextByte();
    this.maxClients = demo.buf.nextByte();
    this._unknown = demo.buf.nextBytes(32);
    this.tickInterval = demo.buf.nextFloat();
    this.serverOS = demo.buf.nextString(8);
    this.gameDirectory = demo.buf.nextNullTerminatedString();
    this.mapName = demo.buf.nextNullTerminatedString();
    this.skyName = demo.buf.nextNullTerminatedString();
    this.hostName = demo.buf.nextNullTerminatedString();
  }
}

export class SvcSendTable extends NetSvcMessage {
  public needsDecoder: boolean;
  public properties: number;
  constructor (demo: Demo) {
    super();
    this.needsDecoder = !!demo.buf.nextBit();
    const length = demo.buf.nextByte();
    this.properties = demo.buf.nextInt(length);
  }
}

/**
 * This and SvcCreateStringTable are currently mostly ignored in favor of
 * the DataTables/StringTables messages. We should probably handle these
 * properly, but I'm not sure how much it really matters? If I understand
 * correctly, the data is the same, just compressed.
 */
export class SvcClassInfo extends NetSvcMessage {
  public serverClasses?: ServerClass[];
  constructor (demo: Demo) {
    super();
    const classCount = demo.buf.nextInt(16);
    const createOnClient = !!demo.buf.nextBit();
    if (!createOnClient) {
      this.serverClasses = [];
      for (let i = 0; i < classCount; i ++) {
        const serverClass = new ServerClass(
          demo.buf.nextInt(DemoBuffer.highestBitIndex(classCount) + 1),
          demo.buf.nextNullTerminatedString(),
          demo.buf.nextNullTerminatedString()
        );
        this.serverClasses.push(serverClass);
      }
    }
  }
}

export class SvcSetPause extends NetSvcMessage {
  public paused: boolean;
  constructor (demo: Demo) {
    super();
    this.paused = !!demo.buf.nextBit();
  }
}

export class SvcCreateStringTable extends NetSvcMessage {
  public name: string;
  public maxEntries: number;
  public entryCount: number;
  public userDataSize: number = 0;
  public userDataSizeBits: number = 0;
  public flags: number;
  constructor (demo: Demo) {
    super();
    this.name = demo.buf.nextNullTerminatedString();
    this.maxEntries = demo.buf.nextInt(16);
    this.entryCount = demo.buf.nextInt(DemoBuffer.highestBitIndex(this.maxEntries) + 1);
    const dataLength = demo.buf.nextInt(20);
    const udataFixedSize = !!demo.buf.nextBit();
    if (udataFixedSize) {
      this.userDataSize = demo.buf.nextInt(12);
      this.userDataSizeBits = demo.buf.nextInt(4);
    }
    this.flags = demo.buf.nextInt(2);
    const dataEnd = demo.buf.cursor + dataLength;

    let table = demo.stringTables.get(this.name);
    if (!table) {
      table = new StringTable(this.name);
      demo.stringTables.set(this.name, table);
    }

    table.maxEntries = this.maxEntries;
    table.userDataSize = this.userDataSize;
    table.userDataSizeBits = this.userDataSizeBits;

    demo.buf.cursor = dataEnd;
  }
}

export class SvcUpdateStringTable extends NetSvcMessage {
  public tableID: number;
  public changedEntries: number = 1;
  constructor (demo: Demo) {
    super();
    this.tableID = demo.buf.nextInt(5);
    if (demo.buf.nextBit()) {
      this.changedEntries = demo.buf.nextInt(16);
    }
    const dataLength = demo.buf.nextInt(20);
    const dataEnd = demo.buf.cursor + dataLength;

    const table = Array.from(demo.stringTables.values())[this.tableID];
    if (!table) {
      console.warn("Tried to update non-existent string table.");
      demo.buf.cursor = dataEnd;
      return;
    }
    if (typeof table.maxEntries !== "number") {
      console.warn("Got SvcUpdateStringTable before SvcCreateStringTable.");
      demo.buf.cursor = dataEnd;
      return;
    }
    const dictionaryEnabled = demo.buf.nextBit();
    if (dictionaryEnabled) {
      console.warn("Unsupported string table update with dictionary.");
      demo.buf.cursor = dataEnd;
      return;
    }

    let entryIndex = -1;
    const history: string[] = [];

    for (let i = 0; i < this.changedEntries; i ++) {

      if (demo.buf.nextBit()) {
        entryIndex ++;
      } else {
        entryIndex = demo.buf.nextInt(DemoBuffer.highestBitIndex(table.maxEntries));
      }

      if (entryIndex > table.entries.length) {
        console.warn("Overflowed string table size when parsing update.");
        demo.buf.cursor = dataEnd;
        return;
      }

      let entryName = "";
      if (demo.buf.nextBit()) {
        const compressed = demo.buf.nextBit();
        if (compressed) {

          const historyIndex = demo.buf.nextInt(5);
          const historyItem = history[historyIndex];
          if (!historyItem) {
            console.warn("Tried to retrieve non-existent entry from string table update history.");
            demo.buf.cursor = dataEnd;
            return;
          }

          const substringLength = demo.buf.nextInt(5);
          if (substringLength > historyItem.length) {
            console.warn("String table update entry substring longer than entry name.");
            demo.buf.cursor = dataEnd;
            return;
          }

          entryName = historyItem.slice(0, substringLength);
          entryName += demo.buf.nextNullTerminatedString();

        } else {
          entryName = demo.buf.nextNullTerminatedString();
        }
      }

      if (history.length === 32) {
        history.shift();
      }
      history.push(entryName);

      const hasData = demo.buf.nextBit();
      if (!hasData) continue;

      const entryDataLength = table.userDataSizeBits || (demo.buf.nextInt(14) * 8);
      if (!entryDataLength) continue;
      const entryDataEnd = demo.buf.cursor + entryDataLength;

      const newEntry = StringTableEntry.fromDemo(table.name, entryName, demo);
      if (entryIndex < table.entries.length) {
        table.entries[entryIndex] = newEntry;
      } else {
        table.entries.push(newEntry);
      }

      demo.buf.cursor = entryDataEnd;

    }

    demo.buf.cursor = dataEnd;
  }
}

export class SvcVoiceInit extends NetSvcMessage {
  public codec: string;
  public quality: number;
  constructor (demo: Demo) {
    super();
    this.codec = demo.buf.nextNullTerminatedString();
    this.quality = demo.buf.nextByte();
    if (this.quality === 255) demo.buf.nextFloat();
  }
}

export class SvcVoiceData extends NetSvcMessage {
  public client: number;
  public proximity: number;
  public audible: boolean[] = [];
  public data: Uint8Array;
  constructor (demo: Demo) {
    super();
    this.client = demo.buf.nextByte();
    this.proximity = demo.buf.nextByte();
    const length = demo.buf.nextInt(16);
    for (let i = 0; i < Message.MSSC; i ++) {
      this.audible.push(!!demo.buf.nextBit());
    }
    this.data = demo.buf.nextBytes(length);
  }
}

export class SvcSetView extends NetSvcMessage {
  public entityIndex: number;
  constructor (demo: Demo) {
    super();
    this.entityIndex = demo.buf.nextInt(11);
  }
}

export class SvcFixAngle extends NetSvcMessage {
  public relative: boolean;
  public angle: Vector;
  constructor (demo: Demo) {
    super();
    this.relative = !!demo.buf.nextBit();
    this.angle = new Vector(
      demo.buf.nextInt(16) * 360 / (1 << 16),
      demo.buf.nextInt(16) * 360 / (1 << 16),
      demo.buf.nextInt(16) * 360 / (1 << 16)
    );
  }
}

export class SvcCrosshairAngle extends NetSvcMessage {
  public angle: Vector;
  constructor (demo: Demo) {
    super();
    this.angle = new Vector(
      demo.buf.nextInt(16) * 360 / (1 << 16),
      demo.buf.nextInt(16) * 360 / (1 << 16),
      demo.buf.nextInt(16) * 360 / (1 << 16)
    );
  }
}

export class SvcPrint extends NetSvcMessage {
  public text: string;
  constructor (demo: Demo) {
    super();
    this.text = demo.buf.nextNullTerminatedString();
  }
}

export class SvcSounds extends NetSvcMessage { // TODO: Full implementation
  public reliable: boolean;
  public count: number;
  public data: Uint8Array;
  constructor (demo: Demo) {
    super();
    this.reliable = !!demo.buf.nextBit();
    if (this.reliable) this.count = 1;
    else this.count = demo.buf.nextByte();
    const length = this.reliable ? demo.buf.nextByte() : demo.buf.nextInt(16);
    this.data = demo.buf.nextBytes(length);
  }
}

export class SvcBspDecal extends NetSvcMessage { // TODO: Full implementation
  constructor (demo: Demo) {
    super();
    let coordinates = 0;
    for (let i = 0; i < 3; i ++) {
      coordinates += demo.buf.nextBit();
    }
    for (let i = 0; i < coordinates; i ++) {
      const integer = demo.buf.nextBit();
      const fraction = demo.buf.nextBit();
      if (integer || fraction) {
        demo.buf.nextBit();
        if (integer) demo.buf.nextInt(14);
        if (fraction) demo.buf.nextInt(5);
      }
    }
    demo.buf.nextInt(9);
    if (demo.buf.nextBit()) {
      demo.buf.nextInt(22);
    }
    demo.buf.nextBit();
  }
}

export class SvcSplitScreen extends NetSvcMessage {
  public removePlayer: boolean;
  public data: Uint8Array;
  constructor (demo: Demo) {
    super();
    this.removePlayer = !!demo.buf.nextBit();
    const length = demo.buf.nextInt(11);
    this.data = demo.buf.nextBytes(length);
  }
}

export class SvcUserMessage extends NetSvcMessage {
  public type: number;
  public data: Uint8Array;
  constructor (demo: Demo) {
    super();
    this.type = demo.buf.nextByte();
    const length = demo.buf.nextInt(12);
    this.data = demo.buf.nextBytes(length);
  }
}

export class SvcEntityMessage extends NetSvcMessage {
  public entityIndex: number;
  public classID: number;
  public data: Uint8Array;
  constructor (demo: Demo) {
    super();
    this.entityIndex = demo.buf.nextInt(11);
    this.classID = demo.buf.nextInt(9);
    const length = demo.buf.nextInt(11);
    this.data = demo.buf.nextBytes(length);
  }
}

export class SvcGameEvent extends NetSvcMessage { // TODO: Full implementation
  public data: Uint8Array;
  constructor (demo: Demo) {
    super();
    const length = demo.buf.nextInt(11);
    this.data = demo.buf.nextBytes(length);
  }
}

export class SvcPacketEntities extends NetSvcMessage {
  public maxEntries: number;
  public isDelta: boolean;
  public deltaFrom?: number;
  public baseline: number;
  public updatedEntries: number;
  public updateBaseline: boolean;
  public updates: EntityUpdate[] = [];
  constructor (demo: Demo) {
    super();

    this.maxEntries = demo.buf.nextInt(11);
    this.isDelta = !!demo.buf.nextBit();
    if (this.isDelta) {
      this.deltaFrom = demo.buf.nextSignedInt(32);
    }
    this.baseline = demo.buf.nextBit();
    this.updatedEntries = demo.buf.nextInt(11);
    const dataLength = demo.buf.nextInt(20);
    this.updateBaseline = !!demo.buf.nextBit();
    const dataEnd = demo.buf.cursor + dataLength;

    if (!demo.dataTables || !demo.serverClasses || !demo.parserClasses) {
      console.warn("Tried to parse SvcPacketEntities before DataTables.");
      demo.buf.cursor = dataEnd;
      return;
    }
    if (this.deltaFrom && this.deltaFrom > demo.state.tick) {
      console.warn(`Received entity delta from the future (${this.deltaFrom} > ${demo.state.tick}).`);
      demo.buf.cursor = dataEnd;
      return;
    }

    if (!this.isDelta) {
      demo.state.entities = new Entities(2048);
    }
    if (!demo.state.entities) {
      console.warn("Received entity delta before a full snapshot.");
      demo.buf.cursor = dataEnd;
      return;
    }

    let index = -1;
    for (let i = 0; i < this.updatedEntries; i ++) {
      index += demo.buf.nextBitInt() + 1;

      if (index < 0 || index > demo.state.entities.length) {
        console.warn("Entity update index overflowed.");
        demo.buf.cursor = dataEnd;
        return;
      }

      const updateType = demo.buf.nextInt(2);
      switch (updateType) {
        case 0: // Delta
        {
          const entity = demo.state.entities[index];
          if (!entity) {
            console.warn("Tried to apply delta to non-existent entity.");
            demo.buf.cursor = dataEnd;
            return;
          }
          const tableID = entity.serverClass.tableID;
          const parserClass = demo.parserClasses[tableID];
          if (!parserClass) {
            console.warn(`Missing parser class for entity "${entity.serverClass.className}".`);
            demo.buf.cursor = dataEnd;
            return;
          }
          const entityProperties = EntityProperty.readProperties(demo, parserClass.flatProperties);
          const update = new EntityDelta(parserClass.serverClass, index, entityProperties);
          Entity.applyDelta(demo, update);
          this.updates.push(update);
          break;
        }

        case 2: // Enter PVS
        {
          const idBits = DemoBuffer.highestBitIndex(demo.serverClasses.length) + 1;
          const tableID = demo.buf.nextInt(idBits);
          const serial = demo.buf.nextInt(10);
          const parserClass = demo.parserClasses[tableID];
          if (!parserClass) {
            console.warn(`Missing parser class for new entity, serial ${serial}.`);
            demo.buf.cursor = dataEnd;
            return;
          }
          const entity = demo.state.entities[index];
          const isNew = !entity || entity.serial !== serial;
          const entityProperties = EntityProperty.readProperties(demo, parserClass.flatProperties);
          const update = new EntityEnterPVS(parserClass.serverClass, index, entityProperties, serial, isNew);
          Entity.enterPVS(demo, update, this.updateBaseline);
          this.updates.push(update);
          break;
        }

        case 1: // Leave PVS
        case 3: // Delete
        {
          const entity = demo.state.entities[index];
          if (!entity) {
            console.warn("Tried to delete non-existent entity.");
            demo.buf.cursor = dataEnd;
            return;
          }
          const doDelete = updateType === 3;
          const update = new EntityLeavePVS(entity.serverClass, index, doDelete);
          Entity.leavePVS(demo, update);
          this.updates.push(update);
          break;
        }

        default: {
          console.warn(`Unknown entity update type: ${updateType}.`);
          demo.buf.cursor = dataEnd;
          return;
        }
      }

    }

    if (this.isDelta) {
      while (demo.buf.nextBit()) {
        const index = demo.buf.nextInt(11);
        const entity = demo.state.entities[index];
        if (!entity) continue;
        const update = new EntityLeavePVS(entity.serverClass, index, true);
        Entity.leavePVS(demo, update);
        this.updates.push(update);
      }
    }

    demo.buf.cursor = dataEnd;
  }
}

export class SvcTempEntities extends NetSvcMessage {
  public entries: number;
  public data: Uint8Array;
  constructor (demo: Demo) {
    super();
    this.entries = demo.buf.nextByte();
    const length = demo.buf.nextInt(17);
    this.data = demo.buf.nextBytes(length);
  }
}

export class SvcPrefetch extends NetSvcMessage {
  public soundIndex: number;
  constructor (demo: Demo) {
    super();
    this.soundIndex = demo.buf.nextInt(13);
  }
}

export class SvcMenu extends NetSvcMessage {
  public menuType: number;
  public data: Uint8Array;
  constructor (demo: Demo) {
    super();
    this.menuType = demo.buf.nextInt(16);
    const length = demo.buf.nextInt(32);
    this.data = demo.buf.nextBytes(length);
  }
}

class GameEventDescriptor {
  public id: number;
  public name: string;
  public keys: Map<string, number>;
  constructor (id: number, name: string, keys: Map<string, number>) {
    this.id = id;
    this.name = name;
    this.keys = keys;
  }
}
export class SvcGameEventList extends NetSvcMessage {
  public events: GameEventDescriptor[] = [];
  constructor (demo: Demo) {
    super();
    const eventCount = demo.buf.nextInt(9);
    const length = demo.buf.nextInt(20);

    for (let i = 0; i < eventCount; i ++) {
      const id = demo.buf.nextInt(9);
      const name = demo.buf.nextNullTerminatedString();
      const keys = new Map();

      let valueType = demo.buf.nextInt(3);
      while (valueType !== 0) {
        const key = demo.buf.nextNullTerminatedString();
        keys.set(key, valueType);
        valueType = demo.buf.nextInt(3);
      }

      const event = new GameEventDescriptor(id, name, keys);
      this.events.push(event);
    }
  }
}

export class SvcGetCvarValue extends NetSvcMessage {
  public cookie: number;
  public cvar: string;
  constructor (demo: Demo) {
    super();
    this.cookie = demo.buf.nextInt(32);
    this.cvar = demo.buf.nextNullTerminatedString();
  }
}

export class SvcCmdKeyValues extends NetSvcMessage {
  public data: Uint8Array;
  constructor (demo: Demo) {
    super();
    const length = demo.buf.nextInt(32) * 8;
    this.data = demo.buf.nextBytes(length);
  }
}

export class SvcPaintmapData extends NetSvcMessage {
  public data: Uint8Array;
  constructor (demo: Demo) {
    super();
    const length = demo.buf.nextInt(32);
    this.data = demo.buf.nextBytes(length);
  }
}
