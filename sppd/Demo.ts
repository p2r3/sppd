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

/**
 * User-friendly interface for the current state of the demo.
 * @prop tick Current server tick. Reports only even numbers on single
 * player games due to sv_alternateticks.
 * @prop players List of {@link Message.CmdInfo} objects, one for each
 * player. "players" might be a bit of a misnomer, as what this really
 * tracks is the camera that the demo follows.
 * @prop entities The primary entity interface. Holds all entities
 * available on the current tick, as well as methods for querying them.
 * See {@link Entity.Entities} for more information.
 * @expand
 */
export interface DemoStateInterface {
  tick: number;
  players: CmdInfo[];
  entities: Entities | null;
}
class DemoState implements DemoStateInterface {
  public tick: number = 0;
  public players: CmdInfo[] = [];
  public entities: Entities | null = null;
}

/**
 * Represents a parsed Portal 2 demo. Manages state and data storage.
 *
 * @prop demoFileStamp File header, should be `HL2DEMO`. However, the parser never verifies this.
 * @prop demoProtocol Demo file protocol, should be `4` for Portal 2.
 * @prop networkProtocol Network protocol, should be `2001` for Portal 2.
 * @prop serverName The game server's address (and port). For a local game, should be `localhost:27015`.
 * @prop clientName Connecting client's username.
 * @prop mapName Name of the map file, with the extension and path omitted. For example, Triple Laser would be `sp_a2_triple_laser`.
 * @prop gameDirectory Name of the "mod folder" for this game, should be `portal2`.
 * @prop playbackTime Duration in seconds. Not exact, often deviates from speedrun timers.
 * @prop playbackTicks Duration in ticks. Not exact, often deviates from speedrun timers.
 * @prop playbackFrames Seems to be an alternateticks-aware tick count, i.e. roughly half of `playbackTicks` for single player.
 * @prop signOnLength Size of sign on data in bytes.
 *
 * @prop messages Array of messages found in the demo, in order of appearance.
 * @prop state User-facing interface for the current state of the demo.
 *
 * @prop buf Internal bitstream buffer, seeked as the demo is parsed.
 * @prop dataTables List of raw SendTables/DataTables found in the demo.
 * @prop serverClasses List of server-side classes reported by the demo.
 * @prop stringTables String table data, mainly from the StringTables message.
 * @prop parserClasses Reconstructed server classes with properties.
 * @prop baselines Entity baselines, i.e. the "default" properties of each entity.
 */
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
  public state: DemoStateInterface;
  // Internal
  public buf: DemoBuffer;
  public dataTables: DataTable[] | null = null;
  public serverClasses: ServerClass[] | null = null;
  public stringTables: Map<string, StringTable> = new Map();
  public parserClasses: ParserClass[] | null = null;
  public baselines: EntityBaseLine[] = [];

  /**
   * @param bytes Buffer containing demo file data.
   * @param events Event handlers (optional):
   * -  **onTick** is called once per server tick. In a single player
   *    game, odd ticks are skipped due to sv_alternateticks.
   * -  **onCommand** is called every time a console command is fired or a
   *    cvar is changed.
   */
  constructor (
    bytes: Uint8Array,
    events?: {
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
        if (events && events.onTick) events.onTick(this);
        lastTick = this.state.tick;
      }

      if (message instanceof StopMessage) break;

      if (!events || !events.onCommand) continue;
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
