import { DemoBuffer } from "./DemoBuffer.ts";
import { Message, StopMessage, CmdInfo } from "./Message.ts";
import { DataTable, ServerClass, ParserClass } from "./DataTable.ts";
import { Entities, EntityBaseLine } from "./Entity.ts";
import { StringTable } from "./StringTable.ts";

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

  constructor (bytes: Uint8Array, callback?: (demo: Demo) => void) {
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
        if (callback) callback(this);
        lastTick = this.state.tick;
      }

      if (message instanceof StopMessage) break;

    }

  }

}
