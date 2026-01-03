export class Vector {

  public x: number;
  public y: number;
  public z: number;

  constructor (x: number = 0, y: number = 0, z: number = 0) {
    this.x = Number(x) || 0;
    this.y = Number(y) || 0;
    this.z = Number(z) || 0;
  }

  // Substitutes for VScript's operator overloads
  Clone (): Vector {
    return new Vector(this.x, this.y, this.z);
  }
  Add (other: Vector): Vector {
    return new Vector(
      this.x + other.x,
      this.y + other.y,
      this.z + other.z
    );
  }
  Sub (other: Vector): Vector {
    return new Vector(
      this.x - other.x,
      this.y - other.y,
      this.z - other.z
    );
  }
  Scale (factor: number): Vector {
    return new Vector(
      this.x * factor,
      this.y * factor,
      this.z * factor
    );
  }
  // Imitations of VScript's Vector methods
  LengthSqr (): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  Length (): number {
    return Math.sqrt(this.LengthSqr());
  }
  Length2DSqr (): number {
    return this.x * this.x + this.y * this.y;
  }
  Length2D (): number {
    return Math.sqrt(this.Length2DSqr());
  }
  Norm (): number {
    const length = this.Length();
    this.x /= length;
    this.y /= length;
    this.z /= length;
    return length;
  }
  Cross (other: Vector): Vector {
    return new Vector(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x
    );
  }
  Dot (other: Vector): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  toString () {
    return `(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`;
  }
  ToKVString () {
    /**
     * Technically, the VScript version of this function adds an extra
     * bracket to the output. I'm not replicating that here, as it's very
     * clearly unintentional.
     */
    return `${this.x} ${this.y} ${this.z}`;
  }

}