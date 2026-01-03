export class DemoBuffer {

  public bytes: Uint8Array;
  public cursor: number = 0;

  constructor (bytes: Uint8Array) {
    if (!bytes) throw "Cannot construct empty buffer.";
    this.bytes = bytes;
    this.cursor = 0;
  }

  getByte (at: number): number {
    const bitOffset = at % 8;
    const byteOffset = Math.floor(at / 8);
    const left = this.bytes[byteOffset] || 0;
    if (bitOffset === 0) return left;
    const right = this.bytes[byteOffset + 1] || 0;
    return (left >>> bitOffset) | ((right << (8 - bitOffset)) & 0xFF);
  }
  getBitSlice (from: number, to: number): Uint8Array {
    const bitOffset = (to - from) % 8;
    const output = new Uint8Array(Math.ceil((to - from) / 8));
    for (let i = from; i < to; i += 8) {
      const byteIndex = Math.floor((i - from) / 8);
      output[byteIndex] = this.getByte(i);
    }
    if (bitOffset !== 0) {
      const lastByte = (output.at(-1) || 0) & ((1 << bitOffset) - 1);
      output[output.length - 1] = lastByte;
    }
    return output;
  }

  getString (from: number, size: number): string {
    return this.getBitSlice(from, from + size)
      .reduce((a, c) => a + String.fromCharCode(c), "");
  }
  getTrimmedString (from: number, size: number): string {
    const string = this.getString(from, size);
    return string.slice(0, string.indexOf('\0'));
  }
  getNullTerminatedString (from: number): string {
    let string = "";
    let i = 0;
    for (let i = 0; i < this.bytes.length * 8; i += 8) {
      const byte = this.getByte(from + i);
      if (byte === 0) return string;
      string += String.fromCharCode(byte);
    }
    console.warn("Reached end of buffer when parsing string.");
    return string;
  }
  getInt (from: number, size: number): number {
    return this.getBitSlice(from, from + size)
      .reverse()
      .reduce((a, c) => (a << 8) + c);
  }
  getSignedInt (from: number, size: number): number {
    const value = this.getInt(from, size);
    const signBit = 1 << (size - 1);
    if (value & signBit) {
      return value - (1 << size);
    }
    return value;
  }
  getFloat (from: number): number {
    const view: DataView = new DataView(this.getBitSlice(from, from + 32).buffer);
    return view.getFloat32(0, true);
  }
  getDouble (from: number): number {
    const view: DataView = new DataView(this.getBitSlice(from, from + 64).buffer);
    return view.getFloat64(0, true);
  }

  nextByte (): number {
    return this.getByte(this.cursor);
  }
  nextBytes (size: number): Uint8Array {
    const bytes = this.getBitSlice(this.cursor, this.cursor + size);
    this.cursor += size;
    return bytes;
  }

  nextString (size: number): string {
    const string = this.getString(this.cursor, size);
    this.cursor += size;
    return string;
  }
  nextTrimmedString (size: number): string {
    const string = this.nextString(size);
    return string.slice(0, string.indexOf('\0'));
  }
  nextNullTerminatedString (): string {
    const string = this.getNullTerminatedString(this.cursor);
    this.cursor += string.length * 8 + 8;
    return string;
  }
  nextInt (size: number): number {
    const int = this.getInt(this.cursor, size);
    this.cursor += size;
    return int;
  }
  nextSignedInt (size: number): number {
    const int = this.getSignedInt(this.cursor, size);
    this.cursor += size;
    return int;
  }
  nextFloat (): number {
    const float = this.getFloat(this.cursor);
    this.cursor += 32;
    return float;
  }
  nextDouble (): number {
    const double = this.getDouble(this.cursor);
    this.cursor += 64;
    return double;
  }

  nextBitInt (): number {
    const ret = this.nextInt(4);
    switch (this.nextInt(2)) {
      case 1: return ret | (this.nextInt(4) << 4);
      case 2: return ret | (this.nextInt(8) << 4);
      case 3: return ret | (this.nextInt(28) << 4);
    }
    return ret;
  }
  nextFieldIndex (lastIndex: number, newWay: boolean): number {
    if (newWay && this.nextInt(1)) return lastIndex + 1;
    let ret;
    if (newWay && this.nextInt(1)) {
      ret = this.nextInt(3);
    } else {
      ret = this.nextInt(5);
      switch (this.nextInt(2)) {
        case 0: break;
        case 1: ret |= (this.nextInt(2) << 5); break;
        case 2: ret |= (this.nextInt(4) << 5); break;
        case 3: ret |= (this.nextInt(7) << 5); break;
      }
    }
    if (ret === 0xFFF) return -1;
    return lastIndex + 1 + ret;
  }

  static highestBitIndex (i: number): number {
    let j;
    for (j = 31; j >= 0 && (i & (1 << j)) === 0; j --);
    return j;
  }

}
