/**
 * String tables contain information about the server, its players,
 * default entity properties, precached sounds and models, etc.
 * @module
 */

import { Demo } from "./Demo.js";
import { EntityProperty, EntityBaseLine } from "./Entity.js";
import type { ServerClass } from "./DataTable.js";

/**
 * A single entry of a {@link StringTable}.
 * @prop tableName Name of the string table that this entry belongs to.
 * @prop entryName Name of this entry.
 */
export class StringTableEntry {

  public tableName: string;
  public entryName: string;
  /**
   * @param tableName {@inheritDoc StringTableEntry.tableName}
   * @param entryName {@inheritDoc StringTableEntry.entryName}
   */
  constructor (tableName: string, entryName: string) {
    this.tableName = tableName;
    this.entryName = entryName;
  }

  /**
   * Parses a string table property from the given demo.
   * @param tableName {@inheritDoc StringTableEntry.tableName}
   * @param entryName {@inheritDoc StringTableEntry.entryName}
   * @param demo {@link Demo} from which to parse.
   * @param compression Compression details, currently unused.
   * @returns A string table entry variant as derived from the table's name.
   */
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

/**
 * One entry per player. Contains information about the user from outside
 * the game world, that is, their Steam account and client details.
 * @prop steamID SteamID64 - a unique Steam account identifier.
 * @prop name Player's Steam username.
 * @prop userID Server user ID, unique to the server.
 * @prop GUID Also a SteamID, just in a different format.
 * @prop friendsID Last half (32 bits) of the SteamID64 in big endian.
 * @prop friendsName Name shown to other players (?)
 * @prop fakePlayer Whether this is a bot player. Supposed to be true for
 * splitscreen co-op players, but doesn't seem to ever actually change.
 * Instead, split-screen players can be identified by checking if {@link name}
 * is `"split"`, {@link GUID} is `"BOT"`, and {@link steamID} is `0`.
 * @prop isHLTV Whether this is an HLTV spectator. Irrelevant for Portal 2.
 * @prop customFilesCRC Checksums for custom logo, sound, model, and text
 * files, respectively.
 * @prop filesDownloaded Number of custom files downloaded by the server.
 */
export class PlayerInfo extends StringTableEntry {
  public steamID: BigInt;
  public name: string;
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
    this.name = demo.buf.nextTrimmedString(32 * 8);
    this.userID = demo.buf.nextSignedInt(32);
    this.GUID = demo.buf.nextTrimmedString(33 * 8);
    demo.buf.nextInt(3 * 8); // C struct byte alignment
    this.friendsID = demo.buf.nextInt(32);
    this.friendsName = demo.buf.nextTrimmedString(32 * 8);
    this.fakePlayer = !!demo.buf.nextByte();
    this.isHLTV = !!demo.buf.nextByte();
    demo.buf.nextInt(2 * 8); // C struct byte alignment
    this.customFilesCRC = [];
    for (let i = 0; i < 4; i ++) {
      this.customFilesCRC.push(demo.buf.nextInt(32));
    }
    this.filesDownloaded = demo.buf.nextByte();
  }
}

/**
 * Lone entry for the server info table. Only contains a port number.
 * @prop port Server port, should be `27015`.
 */
export class QueryPort extends StringTableEntry {
  public port: number;
  constructor (tableName: string, entryName: string, demo: Demo, compression?: number | null) {
    super(tableName, entryName);
    this.port = demo.buf.nextInt(32);
  }
}

/**
 * Defines default property values (baselines) for an entity class.
 * Can only be parsed after DataTables have been received, as this table
 * doesn't define any structure on its own, only values, and only by
 * referring to previously sent classes through an index.
 *
 * @prop serverClass Entity class for which this table is defining baselines.
 * @prop entityProperties List of entity properties parsed from this table.
 */
export class InstanceBaseLine extends StringTableEntry {
  public serverClass?: ServerClass;
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
    this.serverClass = serverClass;

    this.entityProperties = EntityProperty.readProperties(demo, flatProperties);
    EntityBaseLine.updateBaseLine(demo, serverClass, this.entityProperties, flatProperties.length);

  }
}

/**
 * A simple string. Used for some miscellaneous tables.
 */
export class StringEntryData extends StringTableEntry {
  public string: string;
  constructor (tableName: string, entryName: string, demo: Demo, compression?: number | null) {
    super(tableName, entryName);
    this.string = demo.buf.nextNullTerminatedString();
  }
}

/**
 * Defines a [light flicker pattern](https://developer.valvesoftware.com/wiki/Light).
 * @prop pattern Sequence of characters defining a
 * [light flicker pattern](https://developer.valvesoftware.com/wiki/Light).
 */
export class LightStyle extends StringTableEntry {
  public pattern: string;
  constructor (tableName: string, entryName: string, demo: Demo, compression?: number | null) {
    super(tableName, entryName);
    this.pattern = demo.buf.nextNullTerminatedString();
  }
}

/**
 * Used for requesting precaching of various assets such as sounds and
 * models. The `entryName` acts as the identifier for the asset (e.g
 * model/sound file path).
 *
 * @prop flags Flags:
 * - 0x01 - fatal if missing;
 * - 0x02 - actually preload the asset before playback.
 * @prop entryName Asset identifier, usually a file path of some kind.
 */
export class PrecacheData extends StringTableEntry {
  public flags: number;
  constructor (tableName: string, entryName: string, demo: Demo, compression?: number | null) {
    super(tableName, entryName);
    this.flags = demo.buf.nextInt(2);
  }
}

/**
 * Defines a string table class. Currently unused by this parser.
 */
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

/**
 * A lookup table for various categories of information, used to parse data
 * elsewhere throughout the demo.
 *
 * @prop name Table name - defines what kind of data this table holds.
 * String table names are unique to each table and can be used as an identifier.
 *
 * Currently supported are:
 * - `userinfo`: Entries of {@link PlayerInfo}, one per player.
 *    Table size is 64, though Portal 2 only ever uses the first 2 slots.
 * - `server_query_info`: Entries of {@link QueryPort}.
 *    One entry, just the port number.
 * - `instancebaseline`: Entries of {@link InstanceBaseLine},
 *    one per entity class. Fills in default property values.
 * - `GameRulesCreation`: Entries of {@link StringEntryData}.
 *    Normally just one entry containing the class name of the current
 *    game mode's rules (`CPortalGameRules` or `CPortalMPGameRules`).
 * - `InfoPanel`: Entries of {@link StringEntryData}, unused in Portal 2?
 * - `lightstyles`: Entries of {@link LightStyle}, defining
 *    [light flicker patterns](https://developer.valvesoftware.com/wiki/Light)
 *    as sequences of ASCII characters.
 * - `modelprecache`: Entries of {@link PrecacheData}, one per model.
 *    The first non-empty entry is a path to the map file from the mod
 *    directory, file extension included. Then follow entries in the form
 *    `"*<number>"`, where each represents a brush entity. Finally, the
 *    rest are model file paths from the mod directory. Path separators
 *    aren't normalized, so some use forward slashes and others use backslashes.
 * - `genericprecache`: Entries of {@link PrecacheData}. Unused.
 * - `soundprecache`: Entries of {@link PrecacheData}, one per audio file.
 *    The name of each entry is a file path from the `sound/` directory.
 *    Some seem to have a stray `)` character at the start.
 * - `decalprecache`: Entries of {@link PrecacheData}, one per decal file.
 *    The name of each entry is a file path from the mod directory, without
 *    a file extension.
 * @prop entries List of entries found in this table.
 * @prop classes List of classes defined by this table.
 * @prop maxEntries Set in {@link NetSvcMessage.SvcCreateStringTable}. Maximum capacity of this table.
 * @prop userDataSize Set in {@link NetSvcMessage.SvcCreateStringTable}. Used for parsing string table updates.
 * @prop userDataSizeBits Set in {@link NetSvcMessage.SvcCreateStringTable}. Used for parsing string table updates.
 */
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
