/**
 * VScript-like 3D vector implementation.
 */
export class Vector {

  /** @hidden */
  public x: number;
  /** @hidden */
  public y: number;
  /** @hidden */
  public z: number;

  constructor (x: number = 0, y: number = 0, z: number = 0) {
    this.x = Number(x) || 0;
    this.y = Number(y) || 0;
    this.z = Number(z) || 0;
  }

  /**
   * @categoryDescription Arithmetic operations
   * Substitutes for VScript's Vector operator overloads.
   */

  /**
   * Clones this vector to prevent making changes by reference.
   * @returns Copy of this vector.
   */
  Clone (): Vector {
    return new Vector(this.x, this.y, this.z);
  }
  /**
   * Sums two vectors. Does not modify the vectors.
   * @param other Vector to add.
   * @returns A new vector - the sum of the input vectors.
   */
  Add (other: Vector): Vector {
    return new Vector(
      this.x + other.x,
      this.y + other.y,
      this.z + other.z
    );
  }
  /**
   * Subtracts two vectors. Does not modify the vectors.
   * @param other Vector to subtract.
   * @returns A new vector - the difference of the input vectors.
   */
  Sub (other: Vector): Vector {
    return new Vector(
      this.x - other.x,
      this.y - other.y,
      this.z - other.z
    );
  }
  /**
   * Scales the vector's components by the given factor.
   * Does not modify the vector.
   * @param factor Factor by which to scale the vector.
   * @returns A new, scaled vector.
   */
  Scale (factor: number): Vector {
    return new Vector(
      this.x * factor,
      this.y * factor,
      this.z * factor
    );
  }

  /**
   * @categoryDescription VScript metods
   * Imitations of VScript's Vector methods.
   */

  /**
   * Calculates the length of the vector squared.
   * @returns The vector's length squared.
   */
  LengthSqr (): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  /**
   * Calculates the length of the vector.
   * @returns The vector's length.
   */
  Length (): number {
    return Math.sqrt(this.LengthSqr());
  }
  /**
   * Calculates the length of the vector squared, ignoring the Z axis.
   * @returns The vector's length when projected onto the Z plane, squared.
   */
  Length2DSqr (): number {
    return this.x * this.x + this.y * this.y;
  }
  /**
   * Calculates the length of the vector, ignoring the Z axis.
   * @returns The vector's length when projected onto the Z plane.
   */
  Length2D (): number {
    return Math.sqrt(this.Length2DSqr());
  }
  /**
   * Normalizes the vector in-place, turning it into a unit vector.
   * @returns The vector's length before normalizing.
   */
  Norm (): number {
    const length = this.Length();
    this.x /= length;
    this.y /= length;
    this.z /= length;
    return length;
  }
  /**
   * Computes the cross product between this vector and another vector.
   * @param other The vector with which to compute the cross product.
   * @returns A new vector - the cross product of this vector and the other vector.
   */
  Cross (other: Vector): Vector {
    return new Vector(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x
    );
  }
  /**
   * Computes the dot product between this vector and another vector.
   * @param other The vector with which to compute the dot product.
   * @returns The dot product of this vector and the other vector.
   */
  Dot (other: Vector): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  /**
   * Converts the vector to a pretty-printable string.
   * @returns A string in the form `"(x y z)"`, with each component fixed
   * to 3 digits of precision after the decimal point.
   */
  toString () {
    return `(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`;
  }
  /**
   * Converts the vector to a "keyvalue string". Makes more sense in
   * VScript, where setting vector keyvalues from strings is normal.
   *
   * Technically, the VScript version of this function adds an extra
   * bracket to the output. I'm not replicating that here, as it's very
   * clearly unintentional.
   *
   * @returns A string in the form `"x y z"`, not truncated.
   */
  ToKVString () {
    return `${this.x} ${this.y} ${this.z}`;
  }

}