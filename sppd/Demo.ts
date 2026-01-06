import { DemoBuffer } from "./DemoBuffer.ts";
import { DataTable, ServerClass, ParserClass } from "./DataTable.ts";
import { Entities, EntityBaseLine } from "./Entity.ts";
import { StringTable } from "./StringTable.ts";
import {
  Message,
  ConsoleCmdMessage,
  PacketMessage,
  StopMessage,
  CmdInfo
} from "./Message.ts";
import {
  NetSetConVar
} from "./NetSvcMessage.ts"

class DemoState {
  public tick: number = 0;
  public players: CmdInfo[] = [];
  public entities: Entities | null = null;
}

export class Demo {

  // Header
  public demoFileStamp: string;
  public demoProtocol: number;
  public networkProtocol: number;
  public serverName: string;
  public clientName: string;
  public mapName: string;
  public gameDirectory: string;
  public playbackTime: number;
  public playbackTicks: number;
  public playbackFrames: number;
  public signOnLength: number;
  // Data
  public messages: Message[];
  public state: DemoState;
  // Internal
  public buf: DemoBuffer;
  public dataTables: DataTable[] | null = null;
  public stringTables: Map<string, StringTable> = new Map();
  public serverClasses: ServerClass[] | null = null;
  public parserClasses: ParserClass[] | null = null;
  public baselines: EntityBaseLine[] = [];

  constructor (
    bytes: Uint8Array,
    events: {
      onTick?: (demo: Demo) => void,
      onCommand?: (demo: Demo, command: string) => void
    }
  ) {
    this.buf = new DemoBuffer(bytes);

    this.demoFileStamp = this.buf.nextTrimmedString(8 * 8);
    this.demoProtocol = this.buf.nextInt(32);
    this.networkProtocol = this.buf.nextInt(32);
    this.serverName = this.buf.nextTrimmedString(260 * 8);
    this.clientName = this.buf.nextTrimmedString(260 * 8);
    this.mapName = this.buf.nextTrimmedString(260 * 8);
    this.gameDirectory = this.buf.nextTrimmedString(260 * 8);
    this.playbackTime = this.buf.nextFloat();
    this.playbackTicks = this.buf.nextInt(32);
    this.playbackFrames = this.buf.nextInt(32);
    this.signOnLength = this.buf.nextInt(32);

    this.state = new DemoState();
    this.messages = [];

    let lastTick = 0;

    while (this.buf.cursor < this.buf.bytes.length * 8) {

      const message = Message.fromDemo(this);
      this.messages.push(message);

      if (lastTick !== this.state.tick) {
        if (events.onTick) events.onTick(this);
        lastTick = this.state.tick;
      }

      if (message instanceof StopMessage) break;

      if (!events.onCommand) continue;
      if (message instanceof ConsoleCmdMessage) {
        events.onCommand(this, message.command);
      } else if (message instanceof PacketMessage) {
        const convarMessage = message.messages.find(m => m instanceof NetSetConVar);
        if (!convarMessage) continue;
        for (const { name, value } of convarMessage.convars) {
          events.onCommand(this, name + " " + value);
        }
      }

    }

  }

}
