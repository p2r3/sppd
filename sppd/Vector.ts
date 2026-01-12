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

  /**
   * @categoryDescription Utility methods
   * Miscellaneous utility methods for working with data in vectors.
   * Some of these are ported from [ppmod](https://github.com/p2r3/ppmod).
   */

  /**
   * Similar to the Array `map` method, applies a function to each element of the vector.
   * @param callback Function to call for each element of the vector.
   * The function is provided the value and index of the current component.
   * @returns A new vector, gained from applying the callback to each element.
   */
  map (callback: (value: number, index?: number) => number): Vector {
    return new Vector(
      callback(this.x, 0),
      callback(this.y, 1),
      callback(this.z, 2)
    );
  }

  /**
   * Normalizes this vector in-place and returns it,
   * discarding the length byproduct.
   * @returns This vector, normalized.
   */
  Normalize (): Vector {
    this.Norm();
    return this;
  }

  /**
   * Rotates the coordinate vector by a given set of Euler angles.
   * @param angles Euler angles (pitch, yaw, roll) to rotate by, in radians.
   * @returns A new, rotated vector. Original vector is not modified.
   */
  RotateVector (angles: Vector): Vector {
    // Precompute sines and cosines of angles
    const cy = Math.cos(angles.y), sy = Math.sin(angles.y);
    const cp = Math.cos(angles.x), sp = Math.sin(angles.x);
    const cr = Math.cos(angles.z), sr = Math.sin(angles.z);

    // Build rotation matrix
    const m00 = cp * cy;
    const m01 = cp * sy;
    const m02 = -sp;

    const m10 = sr * sp * cy - cr * sy;
    const m11 = sr * sp * sy + cr * cy;
    const m12 = sr * cp;

    const m20 = cr * sp * cy + sr * sy;
    const m21 = cr * sp * sy - sr * cy;
    const m22 = cr * cp;

    // Build output vector from matrix
    return new Vector(
      this.x * m00 + this.y * m10 + this.z * m20,
      this.x * m01 + this.y * m11 + this.z * m21,
      this.x * m02 + this.y * m12 + this.z * m22
    );
  }

  /**
   * Converts direction vector(s) to a vector of pitch/yaw/roll angles.
   * The vector on which this method is called is treated as the
   * forward-vector.
   * @param up Up-vector, optional. If provided, used for calculating roll.
   * @returns A new vector containing Euler angles in radians, in the form
   * (pitch, yaw, roll). Original vector is not modified.
   */
  ToAngles (up?: Vector): Vector {
    // Clone and normalize the forward vector (`this`)
    const forward = this.Clone();
    forward.Norm();
    // Calculate yaw/pitch angles
    const yaw = Math.atan2(forward.y, forward.x);
    const pitch = Math.asin(-forward.z);
    let roll = 0;
    // If an up vector is given, calculate roll
    // Reference: https://www.jldoty.com/code/DirectX/YPRfromUF/YPRfromUF.html
    if (up) {
      // Clone and normalize the input up vector
      up = up.Clone();
      up.Norm();
      // Calculate the current right vector
      const rvec = up.Cross(forward).Normalize();
      // Ensure the up vector is orthonormal
      up = forward.Cross(rvec).Normalize();
      // Calculate right/up vectors at zero roll
      const x0 = new Vector(0, 0, 1).Cross(forward).Normalize();
      const y0 = forward.Cross(x0);
      // Calculate the sine and cosine of the roll angle
      const rollcos = y0.Dot(up);
      let rollsin;
      if (Math.abs(Math.abs(forward.z) - 1) < 0.000001) {
        // Edge case for the forward.z +/- 1.0 singularity
        rollsin = -up.x;
      } else {
        // Choose a denominator that won't divide by zero
        const s = x0.map(Math.abs);
        const c = (s.x > s.y) ? (s.x > s.z ? "x" : "z") : (s.y > s.z ? "y" : "z");
        // Calculate the roll angle sine
        rollsin = (y0[c] * rollcos - up[c]) / x0[c];
      }
      // Calculate the signed roll angle
      roll = Math.atan2(rollsin, rollcos);
    }
    // Return angles as a pitch/yaw/roll vector
    return new Vector(pitch, yaw, roll);
  }

  /**
   * For a set of Euler angles in the form (pitch, yaw, roll) in radians,
   * returns forward-, left-, and up-vectors.
   * @returns Set of forward- and up-facing unit vectors representing the
   * input angles. Original vector is not modified.
   */
  FromAngles (): { forward: Vector, up: Vector } {
    // Precompute sines and cosines of angles
    const cy = Math.cos(this.y), sy = Math.sin(this.y);
    const cp = Math.cos(this.x), sp = Math.sin(this.x);
    const cr = Math.cos(this.z), sr = Math.sin(this.z);

    // Get forward/up vectors
    const forward = new Vector(cy * cp, sy * cp, -sp);
    const wRight = forward.Cross(new Vector(0, 0, 1)).Normalize();
    const up = wRight.Cross(forward).Normalize().Scale(cr).Add(wRight.Scale(sr));

    return { forward, up };
  }

  /**
   * Rotates this vector as a set of (pitch, yaw, roll) Euler angles
   * in radians by another set of such angles.
   * @param rotation Set of Euler angles of form (pitch, yaw, roll)
   * in radians, to rotate by.
   * @returns A new vector containing a rotated set of angles.
   */
  RotateAngles (rotation: Vector): Vector {
    // Parent basis
    const parentBasis = rotation.FromAngles();
    const parentForward = parentBasis.forward;
    const parentUp = parentBasis.up;
    const parentRight = parentUp.Cross(parentForward).Normalize();

    // Local basis
    const localBasis = this.FromAngles();
    const localForward = localBasis.forward;
    const localUp = localBasis.up;

    // Rotate local basis into parent space
    const worldForward =
      parentForward.Scale(localForward.x)
        .Add(parentRight.Scale(localForward.y))
        .Add(parentUp.Scale(localForward.z));

    const worldUp =
      parentForward.Scale(localUp.x)
        .Add(parentRight.Scale(localUp.y))
        .Add(parentUp.Scale(localUp.z));

    // Convert back to angles
    return worldForward.ToAngles(worldUp);
  }

}
