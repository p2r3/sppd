/**
 * Contains definitions and parsers for the various messages found in a
 * Source engine demo file.
 * @module
 */

import { Demo } from "./Demo.js";
import { DemoBuffer } from "./DemoBuffer.js";
import { Vector } from "./Vector.js";
import { NetSvcMessage } from "./NetSvcMessage.js";
import { StringTable } from "./StringTable.js";
import { DataTable, ServerClass, ParserClass } from "./DataTable.js";

/**
 * Base message class, doesn't represent any data on its own.
 * @prop tick The tick that this message was sent on.
 * @prop slot Index of the player that this message belongs to.
 * @prop MSSC Max Split-Screen Clients, always `2` in Portal 2.
 */
export class Message {

  public tick: number;
  public slot: number;
  /**
   * @param tick {@inheritDoc Message.tick}
   * @param slot {@inheritDoc Message.slot}
   */
  constructor (tick: number, slot: number) {
    this.tick = tick;
    this.slot = slot;
  }

  /**
   * Parses the demo to retrieve the next message, updating its state
   * in the process.
   * @returns The next message in the demo.
   */
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

/**
 * Basic information about the camera which the demo is following.
 * Not a demo message in itself, but rather a part of the Packet/SignOn messages.
 * @prop flags Flags:
 *  - 0x01: Use `viewOrigin2` (`FDEMO_USE_ORIGIN2`)
 *  - 0x02: Use `viewAngles2` (`FDEMO_USE_ANGLES2`)
 *  - 0x04: Don't interpolate (`FDEMO_NOINTERP`)
 * @prop viewOrigin Camera position in 3D space.
 * @prop viewAngles Camera Euler angles (pitch, yaw, roll), in degrees.
 * @prop localViewAngles Seems to be no different from `viewAngles`?
 * @prop viewOrigin2 "Resampled" camera position, supposedly for smoothened or
 * scripted camera motion. Usually a zero vector.
 * @prop viewAngles2 "Resampled" camera angles, supposedly for smoothened or
 * scripted camera motion. Usually a zero vector.
 * @prop localViewAngles2 Seems to be no different from `viewAngles2`?
 */
export class CmdInfo {
  public flags: number;
  public viewOrigin: Vector;
  public viewAngles: Vector;
  public localViewAngles: Vector;
  public viewOrigin2: Vector;
  public viewAngles2: Vector;
  public localViewAngles2: Vector;

  /** Parses the data from a DemoBuffer object. */
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
/**
 * Contains viewpoint data and network packets (Net/Svc messages).
 * @prop packetInfo Camera position data, one entry per player.
 * @prop inSequence Inbound packet number, used to detect
 * duplicated/dropped/misordered packets.
 * @prop outSequence Outbound packet number.
 * @prop messages List of parsed Net/Svc messages (packets).
 */
export class PacketMessage extends Message {

  public packetInfo: CmdInfo[];
  public inSequence: number;
  public outSequence: number;
  public messages: NetSvcMessage[] = [];

  /** Parses the message from a Demo object. */
  constructor (tick: number, slot: number, demo: Demo) {
    super(tick, slot);

    this.packetInfo = [
      new CmdInfo(demo.buf),
      new CmdInfo(demo.buf)
    ];
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

/**
 * Effectively the same as {@link PacketMessage}, except:
 * - sent only once at the start of a demo;
 * - contains some packets that don't show up in {@link PacketMessage}.
 */
export class SignOnMessage extends PacketMessage {
  /** Parses the message from a Demo object. */
  constructor (tick: number, slot: number, demo: Demo) {
    super(tick, slot, demo);
  }
}

/**
 * Synchronizes the client's clock to the demo tick.
 * Contains no data.
 */
export class SyncTickMessage extends Message {
  /** Parses the message from a Demo object. */
  constructor (tick: number, slot: number) {
    super(tick, slot);
  }
}

/**
 * Contains unexpanded lookup tables for entity classes and their properties.
 *
 * [See here](https://github.com/UncraftedName/UntitledParser/blob/de6dffd18c186413c861c26bdb260aaaca6e4955/DemoParser/src/Parser/Components/Packets/DataTables.cs#L11)
 * for a more in-depth explanation.
 *
 * @prop dataTables List of DataTables/SendTables parsed from this message.
 * @prop serverClasses List of ServerClass-to-DataTable mappings parsed from this message.
 */
export class DataTablesMessage extends Message {

  dataTables: DataTable[] = [];
  serverClasses: ServerClass[] = [];

  /** Parses the message from a Demo object. */
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

/**
 * Marks the end of a demo.
 */
export class StopMessage extends Message {
  /** Parses the message from a Demo object. */
  constructor (tick: number, slot: number) {
    super(tick, slot);
  }
}

/**
 * Arbitrary custom data. Used by the co-op radial menu,
 * and by plugins like [SAR](https://github.com/p2sr/SourceAutoRecord).
 * @prop callbackIndex Callback function index:
 *  - `-1` - list of registered callback functions;
 *  - `0` - `RadialMenuMouseCallback`, also hijacked by SAR to inject timer data.
 * @prop cursor 2D vector containing radial menu cursor coordinates,
 * available only if the callback is `RadialMenuMouseCallback`.
 * @prop data Raw data buffer, available if the callback is _not_ `RadialMenuMouseCallback`.
 */
export class CustomDataMessage extends Message {

  public callbackIndex: number;
  public cursor?: Vector;
  public data?: Uint8Array;

  /** Parses the message from a Demo object. */
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

/**
 * Contains lookup tables for anything from player info to models to entity baselines.
 * [See here](https://github.com/UncraftedName/UntitledParser/blob/de6dffd18c186413c861c26bdb260aaaca6e4955/DemoParser/src/Parser/Components/Packets/StringTables.cs#L8)
 * for a more in-depth explanation.
 *
 * @prop tables List of string tables parsed from this message.
 */
export class StringTablesMessage extends Message {

  public tables: StringTable[] = [];

  /** Parses the message from a Demo object. */
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

/**
 * Contains a single console command executed by the client.
 */
export class ConsoleCmdMessage extends Message {

  public command: string;

  constructor (tick: number, slot: number, demo: Demo) {
    super(tick, slot);

    const length = demo.buf.nextInt(32) * 8;
    this.command = demo.buf.nextString(length);
  }

}

/**
 * Contains the player's inputs and information about certain in-game actions.
 * @prop commandNumber Command sequence number
 * @prop tickCount Server tick, tends to deviate from {@link NetSvcMessage.NetTick.tick}
 * by up to 2 ticks or so.
 * @prop viewAngles Player view angles (pitch, yaw, roll) in degrees.
 * @prop movement Player movement impulse (forward, sideways, vertical).
 * @prop mouseDelta 2D vector of raw mouse movement deltas.
 * @prop buttons Button flags. [See here](https://github.com/UncraftedName/UntitledParser/blob/de6dffd18c186413c861c26bdb260aaaca6e4955/DemoParser/src/Parser/Components/Packets/UserCmd.cs#L77)
 * for a list of possible values.
 * @prop heldEntity If nonzero, entindex of the entity that was just picked up.
 * Doesn't seem to catch _every_ pickup, though.
 * @prop heldEntityPortal If nonzero, entindex of the portal through which
 * an entity was picked up.
 * @prop predictedPortalTeleportations (Number of?) predicted portal teleportations.
 * Doesn't seem to ever actually appear?
 * @prop weaponSelect Selected weapon index (irrelevant for Portal 2).
 * @prop weaponSubtype Selected weapon subtype index (irrelevant for Portal 2).
 * @prop pendingAcks Pending acknowledgements of this message.
 */
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
