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

    for (let i = 0; i < 2; i ++) {
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

  public callbackIndex: number;
  public cursor?: Vector;
  public data?: Uint8Array;

  constructor (tick: number, slot: number, demo: Demo) {
    super(tick, slot);

    this.callbackIndex = demo.buf.nextInt(32);
    const dataLength = demo.buf.nextInt(32) * 8;

    if (this.callbackIndex === 0 && dataLength === 64) {
      this.cursor = new Vector(
        demo.buf.nextSignedInt(32),
        demo.buf.nextSignedInt(32)
      );
      return;
    }

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

export class UserCmdMessage extends Message {

  public commandNumber: number;
  public tickCount: number = 0;

  public viewAngles: Vector = new Vector();
  public movement: Vector = new Vector();
  public mouseDelta: Vector = new Vector();

  public buttons: number = 0;
  public impulse: number = 0;

  public heldEntity: number = 0;
  public heldEntityPortal: number = 0;
  public predictedPortalTeleportations: number = 0;

  public weaponSelect: number = 0;
  public weaponSubtype: number = 0;
  public pendingAcks: number = 0;

  constructor (tick: number, slot: number, demo: Demo) {
    super(tick, slot);

    this.commandNumber = demo.buf.nextInt(32);

    const dataLength = demo.buf.nextSignedInt(32) * 8;
    const dataEnd = demo.buf.cursor + dataLength;

    if (demo.buf.nextBit()) demo.buf.nextInt(32); // Same as commandNumber
    if (demo.buf.nextBit()) this.tickCount = demo.buf.nextInt(32);
    if (demo.buf.nextBit()) this.viewAngles.x = demo.buf.nextFloat();
    if (demo.buf.nextBit()) this.viewAngles.y = demo.buf.nextFloat();
    if (demo.buf.nextBit()) this.viewAngles.z = demo.buf.nextFloat();
    if (demo.buf.nextBit()) this.movement.x = demo.buf.nextFloat();
    if (demo.buf.nextBit()) this.movement.y = demo.buf.nextFloat();
    if (demo.buf.nextBit()) this.movement.z = demo.buf.nextFloat();
    if (demo.buf.nextBit()) this.buttons = demo.buf.nextInt(32);
    if (demo.buf.nextBit()) this.impulse = demo.buf.nextByte();
    if (demo.buf.nextBit()) {
      this.weaponSelect = demo.buf.nextInt(11);
      if (this.weaponSelect) console.log(this.weaponSelect);
      if (demo.buf.nextBit()) {
        this.weaponSubtype = demo.buf.nextInt(6);
      }
    }
    if (demo.buf.nextBit()) this.mouseDelta.x = demo.buf.nextSignedInt(16);
    if (demo.buf.nextBit()) this.mouseDelta.y = demo.buf.nextSignedInt(16);
    if (demo.buf.nextBit()) this.heldEntity = demo.buf.nextInt(16);
    if (demo.buf.nextBit()) this.heldEntityPortal = demo.buf.nextInt(16);
    if (demo.buf.nextBit()) this.pendingAcks = demo.buf.nextInt(16);
    if (demo.buf.nextBit()) this.predictedPortalTeleportations = demo.buf.nextByte();
    if (this.predictedPortalTeleportations) console.log(this.predictedPortalTeleportations);

    demo.buf.cursor = dataEnd;

  }

}
