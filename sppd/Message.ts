import { Demo } from "./Demo.ts";
import { DemoBuffer } from "./DemoBuffer.ts";
import { Vector } from "./Vector.ts";
import { NetSvcMessage } from "./NetSvcMessage.ts";
import { StringTable } from "./StringTable.ts";
import { DataTable, ServerClass, ParserClass } from "./DataTable.ts";

export class Message {

  public tick: number;
  public slot: number;
  constructor (tick: number, slot: number) {
    this.tick = tick;
    this.slot = slot;
  }

  static MSSC: number = 2;

  static fromDemo (demo: Demo): Message {
    const type = demo.buf.nextByte();
    const tick = demo.buf.nextInt(32);
    const slot = demo.buf.nextByte();
    switch (type) {
      case 1: return new SignOnMessage(tick, slot, demo);
      case 2: return new PacketMessage(tick, slot, demo);
      case 3: return new SyncTickMessage(tick, slot);
      case 4: return new ConsoleCmdMessage(tick, slot, demo);
      case 5: return new UserCmdMessage(tick, slot, demo);
      case 6: return new DataTablesMessage(tick, slot, demo);
      case 7: return new StopMessage(tick, slot);
      case 8: return new CustomDataMessage(tick, slot, demo);
      case 9: return new StringTablesMessage(tick, slot, demo);
      default: throw `Unknown message type: ${type}`;
    }
  }

}

export class CmdInfo {
  public flags: number;
  public viewOrigin: Vector;
  public viewAngles: Vector;
  public localViewAngles: Vector;
  public viewOrigin2: Vector;
  public viewAngles2: Vector;
  public localViewAngles2: Vector;

  constructor (dbuffer: DemoBuffer) {
    this.flags = dbuffer.nextInt(32);
    this.viewOrigin = new Vector(dbuffer.nextFloat(), dbuffer.nextFloat(), dbuffer.nextFloat());
    this.viewAngles = new Vector(dbuffer.nextFloat(), dbuffer.nextFloat(), dbuffer.nextFloat());
    this.localViewAngles = new Vector(dbuffer.nextFloat(), dbuffer.nextFloat(), dbuffer.nextFloat());
    this.viewOrigin2 = new Vector(dbuffer.nextFloat(), dbuffer.nextFloat(), dbuffer.nextFloat());
    this.viewAngles2 = new Vector(dbuffer.nextFloat(), dbuffer.nextFloat(), dbuffer.nextFloat());
    this.localViewAngles2 = new Vector(dbuffer.nextFloat(), dbuffer.nextFloat(), dbuffer.nextFloat());
  }
}
export class PacketMessage extends Message {

  public packetInfo: CmdInfo[] = [];
  public inSequence: number;
  public outSequence: number;
  public messages: NetSvcMessage[] = [];

  constructor (tick: number, slot: number, demo: Demo) {
    super(tick, slot);

    for (let i = 0; i < Message.MSSC; i ++) {
      const info = new CmdInfo(demo.buf);
      this.packetInfo.push(info);
    }
    demo.state.players = this.packetInfo;

    this.inSequence = demo.buf.nextInt(32);
    this.outSequence = demo.buf.nextInt(32);

    const dataLength = demo.buf.nextInt(32) * 8;
    const dataEnd = demo.buf.cursor + dataLength;

    while (demo.buf.cursor < dataEnd - 6) {
      const id = demo.buf.nextInt(6);
      const message = NetSvcMessage.fromID(id, demo);
      if (!message) break;
      this.messages.push(message);
    }
    demo.buf.cursor = dataEnd;

  }

}

export class SignOnMessage extends PacketMessage {
  constructor (tick: number, slot: number, demo: Demo) {
    super(tick, slot, demo);
  }
}

export class SyncTickMessage extends Message {
  constructor (tick: number, slot: number) {
    super(tick, slot);
  }
}

export class DataTablesMessage extends Message {

  dataTables: DataTable[] = [];
  serverClasses: ServerClass[] = [];

  constructor (tick: number, slot: number, demo: Demo) {
    super(tick, slot);

    const dataLength = demo.buf.nextInt(32) * 8;
    const dataEnd = dataLength + demo.buf.cursor;

    while (demo.buf.nextBit()) {
      this.dataTables.push(new DataTable(demo));
    }
    const classCount = demo.buf.nextInt(16);
    for (let i = 0; i < classCount; i ++) {
      this.serverClasses.push(new ServerClass(
        demo.buf.nextInt(16),
        demo.buf.nextNullTerminatedString(),
        demo.buf.nextNullTerminatedString()
      ));
    }
    demo.buf.cursor = dataEnd;

    demo.dataTables = this.dataTables;
    demo.serverClasses = this.serverClasses;

    demo.parserClasses = ParserClass.fromDemo(demo);

  }

}

export class StopMessage extends Message {
  constructor (tick: number, slot: number) {
    super(tick, slot);
  }
}

export class CustomDataMessage extends Message {

  public int: number;
  public data: Uint8Array;

  constructor (tick: number, slot: number, demo: Demo) {
    super(tick, slot);

    this.int = demo.buf.nextInt(32);
    const dataLength = demo.buf.nextInt(32) * 8;
    this.data = demo.buf.nextBytes(dataLength);
  }

}

export class StringTablesMessage extends Message {

  public tables: StringTable[] = [];

  constructor (tick: number, slot: number, demo: Demo) {
    super(tick, slot);

    const dataLength = demo.buf.nextInt(32) * 8;
    const dataEnd = demo.buf.cursor + dataLength;

    const tableCount = demo.buf.nextByte();
    for (let i = 0; i < tableCount; i ++) {
      const table = StringTable.fromDemo(demo);
      this.tables.push(table);
      demo.stringTables.set(table.name, table);
    }

    demo.buf.cursor = dataEnd;
  }

}

export class ConsoleCmdMessage extends Message {

  public command: string;

  constructor (tick: number, slot: number, demo: Demo) {
    super(tick, slot);

    const length = demo.buf.nextInt(32) * 8;
    this.command = demo.buf.nextString(length);
  }

}

export class UserCmdInfo {
  number?: number;
  tickCount?: number;
  viewAnglesX?: number;
  viewAnglesY?: number;
  viewAnglesZ?: number;
  forwardMove?: number;
  sideMove?: number;
  upMove?: number;
  buttons?: number;
  impulse?: number;
  weaponSelect?: number;
  weaponSubtype?: number;
  mouseDeltaX?: number
  mouseDeltaY?: number
  constructor (dbuffer: DemoBuffer) {
    if (dbuffer.nextBit()) this.number = dbuffer.nextInt(32);
    if (dbuffer.nextBit()) this.tickCount = dbuffer.nextInt(32);
    if (dbuffer.nextBit()) this.viewAnglesX = dbuffer.nextFloat();
    if (dbuffer.nextBit()) this.viewAnglesY = dbuffer.nextFloat();
    if (dbuffer.nextBit()) this.viewAnglesZ = dbuffer.nextFloat();
    if (dbuffer.nextBit()) this.forwardMove = dbuffer.nextFloat();
    if (dbuffer.nextBit()) this.sideMove = dbuffer.nextFloat();
    if (dbuffer.nextBit()) this.upMove = dbuffer.nextFloat();
    if (dbuffer.nextBit()) this.buttons = dbuffer.nextInt(32);
    if (dbuffer.nextBit()) this.impulse = dbuffer.nextByte();
    if (dbuffer.nextBit()) {
      this.weaponSelect = dbuffer.nextInt(11);
      if (dbuffer.nextBit()) {
        this.weaponSubtype = dbuffer.nextInt(6);
      }
    }
    if (dbuffer.nextBit()) this.mouseDeltaX = dbuffer.nextInt(16);
    if (dbuffer.nextBit()) this.mouseDeltaY = dbuffer.nextInt(16);
  }
}
export class UserCmdMessage extends Message {

  public id: number;
  public info: UserCmdInfo[] = [];

  constructor (tick: number, slot: number, demo: Demo) {
    super(tick, slot);

    this.id = demo.buf.nextInt(32);

    const dataLength = demo.buf.nextInt(32) * 8;
    const dataEnd = demo.buf.cursor + dataLength;

    while (demo.buf.cursor < dataEnd) {
      this.info.push(new UserCmdInfo(demo.buf));
    }
    demo.buf.cursor = dataEnd;

  }

}
