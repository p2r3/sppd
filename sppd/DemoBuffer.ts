/**
 * Provides an interface for handling the bitstream formats of a Source engine demo file.
 * @module
 */

/**
 * Internal demo buffer.
 * Implements various bitstream read/write tools.
 *
 * @prop bytes File byte buffer.
 * @prop cursor Bit (not byte!) cursor, indicating where the "read head" is.
 *    All `next*` methods increment this value when reading.
 */
export class DemoBuffer {

  public bytes: Uint8Array;
  public cursor: number = 0;

  /**
   * @param bytes Input file byte buffer.
   */
  constructor (bytes: Uint8Array) {
    if (!bytes) throw "Cannot construct empty buffer.";
    this.bytes = bytes;
    this.cursor = 0;
  }

  /**
   * Reads the value of the bit at the given position.
   * @param at Absolute bit address.
   * @returns Bit value - 0 or 1.
   */
  getBit (at: number): number {
    const bitOffset = at % 8;
    const byteOffset = Math.floor(at / 8);
    const byte = this.bytes[byteOffset] || 0;
    return (byte >> bitOffset) & 1;
  }
  /**
   * Reads one unsigned byte (8 bits) starting from the given position.
   * @param at Absoulute bit address.
   * @returns Byte value - [0; 255].
   */
  getByte (at: number): number {
    const bitOffset = at % 8;
    const byteOffset = Math.floor(at / 8);
    const left = this.bytes[byteOffset] || 0;
    if (bitOffset === 0) return left;
    const right = this.bytes[byteOffset + 1] || 0;
    return (left >>> bitOffset) | ((right << (8 - bitOffset)) & 0xFF);
  }
  /**
   * Reads a byte buffer in the given bit range.
   * @param from Start of range (bits, inclusive).
   * @param to End of range (bits, not inclusive).
   * @returns Byte array containing data from within the specified range.
   */
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
  /**
   * Reads an ASCII string in the given bit range.
   * @param from Absolute bit address.
   * @param size Length in bits.
   * @returns Parsed ASCII string.
   */
  getString (from: number, size: number): string {
    return this.getBitSlice(from, from + size)
      .reduce((a, c) => a + String.fromCharCode(c), "");
  }
  /**
   * Reads an ASCII string in the given bit range,
   * keeping only the part before any null characters.
   * @param from Absolute bit address.
   * @param size Length in bits.
   * @returns Parsed ASCII string.
   */
  getTrimmedString (from: number, size: number): string {
    const string = this.getString(from, size);
    return string.slice(0, string.indexOf('\0'));
  }
  /**
   * Reads a null-terminated ASCII string.
   * @param from Absolute bit address.
   * @returns Parsed ASCII string.
   */
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
  /**
   * Reads an unsigned integer of arbitrary bit width.
   * @param from Absolute bit address.
   * @param size Bit width (size in bits) of the integer.
   * @returns Parsed integer value.
   */
  getInt (from: number, size: number): number {
    const bytes = this.getBitSlice(from, from + size);
    let output = 0;
    for (let i = bytes.length - 1; i >= 0; i --) {
      output = output * 256 + (bytes[i] || 0);
    }
    return output;
  }
  /**
   * Reads a signed integer of arbitrary bit width.
   * @param from Absolute bit address.
   * @param size Bit width (size in bits) of the integer.
   * @returns Parsed signed integer value.
   */
  getSignedInt (from: number, size: number): number {
    const value = this.getInt(from, size);
    const signBit = 1 << (size - 1);
    if (value & signBit) {
      return value - (1 << size);
    }
    return value;
  }
  /**
   * Reads a 32-bit floating point value.
   * @param from Absolute bit address.
   * @returns Parsed float value.
   */
  getFloat (from: number): number {
    const view: DataView = new DataView(this.getBitSlice(from, from + 32).buffer);
    return view.getFloat32(0, true);
  }
  /**
   * Reads a 64-bit floating point value.
   * @param from Absolute bit address.
   * @returns Parsed float value.
   */
  getDouble (from: number): number {
    const view: DataView = new DataView(this.getBitSlice(from, from + 64).buffer);
    return view.getFloat64(0, true);
  }


  /**
   * Reads the bit at the cursor, and increments the cursor.
   * @returns Bit value - 0 or 1.
   */
  nextBit (): number {
    return this.getBit(this.cursor++);
  }
  /**
   * Reads one unsigned byte (8 bits) at the cursor, and moves the cursor forward.
   * @returns Byte value - [0; 255].
   */
  nextByte (): number {
    const byte = this.getByte(this.cursor);
    this.cursor += 8;
    return byte;
  }
  /**
   * Reads a byte buffer starting from the cursor, and moves the cursor past it.
   * @param size Size in bits.
   * @returns Byte array containing data from within the specified range.
   */
  nextBytes (size: number): Uint8Array {
    const bytes = this.getBitSlice(this.cursor, this.cursor + size);
    this.cursor += size;
    return bytes;
  }
  /**
   * Reads an ASCII string of the specified length at the cursor,
   * and moves the cursor past it.
   * @param size Length in bits.
   * @returns Parsed ASCII string.
   */
  nextString (size: number): string {
    const string = this.getString(this.cursor, size);
    this.cursor += size;
    return string;
  }
  /**
   * Reads an ASCII string of the specified length at the cursor,
   * keeping only the part before any null characters, and moves
   * the cursor past it.
   * @param size Length in bits.
   * @returns Parsed ASCII string.
   */
  nextTrimmedString (size: number): string {
    const string = this.nextString(size);
    return string.slice(0, string.indexOf('\0'));
  }
  /**
   * Reads a null-terminated ASCII string at the cursor,
   * and moves the cursor past it.
   * @returns Parsed ASCII string.
   */
  nextNullTerminatedString (): string {
    const string = this.getNullTerminatedString(this.cursor);
    this.cursor += string.length * 8 + 8;
    return string;
  }
  /**
   * Reads an unsigned integer of arbitrary bit width at the cursor,
   * and moves the cursor past it.
   * @param size Bit width (size in bits) of the integer.
   * @returns Parsed integer value.
   */
  nextInt (size: number): number {
    const int = this.getInt(this.cursor, size);
    this.cursor += size;
    return int;
  }
  /**
   * Reads a signed integer of arbitrary bit width at the cursor,
   * and moves the cursor past it.
   * @param size Bit width (size in bits) of the integer.
   * @returns Parsed signed integer value.
   */
  nextSignedInt (size: number): number {
    const int = this.getSignedInt(this.cursor, size);
    this.cursor += size;
    return int;
  }
  /**
   * Reads a 32-bit floating point value at the cursor,
   * and moves the cursor past it.
   * @returns Parsed float value.
   */
  nextFloat (): number {
    const float = this.getFloat(this.cursor);
    this.cursor += 32;
    return float;
  }
  /**
   * Reads a 64-bit floating point value at the cursor,
   * and moves the cursor past it.
   * @returns Parsed float value.
   */
  nextDouble (): number {
    const double = this.getDouble(this.cursor);
    this.cursor += 64;
    return double;
  }
  /**
   * Reads a variable-length unsigned integer at the cursor,
   * and moves the cursor past it.
   * @returns Parsed integer value.
   */
  nextBitInt (): number {
    const ret = this.nextInt(4);
    switch (this.nextInt(2)) {
      case 1: return ret | (this.nextInt(4) << 4);
      case 2: return ret | (this.nextByte() << 4);
      case 3: return ret | ((this.nextInt(28) << 4) >>> 0);
    }
    return ret;
  }
  /**
   * Reads the next index in a sequence of fields using a variable-length
   * encoding, and moves the cursor past it.
   * @param lastIndex Preceding index value, -1 to start an iteration.
   * @param newWay Whether to use the "new way" of parsing(?)
   * Pretty much always true for Portal 2 demos.
   * @returns The next index in the sequence.
   */
  nextFieldIndex (lastIndex: number, newWay: boolean): number {
    if (newWay && this.nextBit()) return lastIndex + 1;
    let ret;
    if (newWay && this.nextBit()) {
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
  /**
   * Finds the index of the most significant set bit in the input integer.
   * @param i Integer value.
   * @returns Index of the most significant set bit.
   */
  static highestBitIndex (i: number): number {
    let j;
    for (j = 31; j >= 0 && (i & (1 << j)) === 0; j --);
    return j;
  }


  /**
   * Modifies the buffer to set a bit at the given address.
   * @param at Absolute bit address.
   * @param value Value to write - 0 or 1.
   */
  setBit (at: number, value: number | boolean): void {
    const byteIndex = Math.floor(at / 8);
    const bitIndex = at % 8;
    const byte = this.bytes[byteIndex] || 0;
    const bit = 1 << bitIndex;
    if (value) {
      this.bytes[byteIndex] = byte | bit;
    } else {
      this.bytes[byteIndex] = byte & ~bit;
    }
  }
  /**
   * Modifies the buffer to write an unsigned integer at the given address.
   * @param from Absolute bit address.
   * @param size Bit width (size in bits) of the integer.
   * @param value Value to write.
   */
  setInt (from: number, size: number, value: number): void {
    for (let i = 0; i < size; i ++) {
      this.setBit(from + i, value & (1 << i));
    }
  }
  /**
   * Modifies the buffer to write a signed integer at the given address.
   * @param from Absolute bit address.
   * @param size Bit width (size in bits) of the integer.
   * @param value Value to write.
   */
  setSignedInt (from: number, size: number, value: number): void {
    if (value < 0) value = (1 << size) + value;
    this.setInt(from, size, value);
  }
  /**
   * Modifies the buffer to write a 32-bit floating point number at the given address.
   * @param from Absolute bit address.
   * @param value Value to write.
   */
  setFloat (from: number, value: number): void {
    const dataView = new DataView(new ArrayBuffer(4));
    dataView.setFloat32(0, value);
    this.setInt(from, 32, dataView.getUint32(0));
  }

}
