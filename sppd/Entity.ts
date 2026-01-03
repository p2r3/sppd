import { Demo } from "./Demo.ts";
import { DemoBuffer } from "./DemoBuffer.ts";
import { Vector } from "./Vector.ts";
import {
  DataTableProperty,
  DataTablePropertyType,
  DataTablePropertyFlag,
  ServerClass,
  FlatProperty
} from "./DataTable.ts";

type EntityPropertyValueType = (
    number
  | string
  | Vector
  | number[]
  | string[]
  | Vector[]
);

export class EntityProperty {

  public index: number;
  public property: FlatProperty;
  public bufferFrom: number;
  public bufferSize: number;
  public value: EntityPropertyValueType;

  constructor (
    index: number,
    property: FlatProperty,
    bufferFrom: number,
    bufferSize: number,
    value: EntityPropertyValueType
  ) {
    this.index = index;
    this.property = property;
    this.bufferFrom = bufferFrom;
    this.bufferSize = bufferSize;
    this.value = value;
  }

  static fromDemo (demo: Demo, index: number, flatProperty: FlatProperty) {

    const bufferFrom = demo.buf.cursor;
    const baseProperty = flatProperty.baseProperty;
    const baseArrayProperty = flatProperty.baseArrayProperty;
    let value: EntityPropertyValueType;

    switch (baseProperty.type) {

      case DataTablePropertyType.Int: {
        value = EntityProperty.decodeInt(demo, baseProperty);
        break;
      }
      case DataTablePropertyType.Float: {
        value = EntityProperty.decodeFloat(demo, baseProperty);
        break;
      }
      case DataTablePropertyType.Vector3: {
        value = EntityProperty.decodeVector3(demo, baseProperty);
        break;
      }
      case DataTablePropertyType.Vector2: {
        value = EntityProperty.decodeVector2(demo, baseProperty);
        break;
      }
      case DataTablePropertyType.String: {
        value = EntityProperty.decodeString(demo, baseProperty);
        break;
      }
      case DataTablePropertyType.Array: {
        value = EntityProperty.decodeArray(demo, baseProperty, baseArrayProperty);
        break;
      }

      default: throw `Unknown property type ${baseProperty.type}.`;
    }

    const bufferSize = demo.buf.cursor - bufferFrom;

    return new EntityProperty(index, flatProperty, bufferFrom, bufferSize, value);

  }

  static decodeInt (demo: Demo, baseProperty: DataTableProperty): number {
    if (!baseProperty.value) throw "Invalid property definition.";

    if (baseProperty.hasFlag(DataTablePropertyFlag.Unsigned)) {
      return demo.buf.nextInt(baseProperty.value.bits);
    } else {
      return demo.buf.nextSignedInt(baseProperty.value.bits);
    }
  }

  static decodeFloat (demo: Demo, baseProperty: DataTableProperty): number {
    if (!baseProperty.value) throw "Invalid property definition.";

    if (
      baseProperty.hasFlag(DataTablePropertyFlag.Coord)
    ) {

      let value = 0;
      const hasInt = demo.buf.nextInt(1);
      const hasFrac = demo.buf.nextInt(1);
      if (hasInt || hasFrac) {
        const sign = demo.buf.nextInt(1);
        if (hasInt) value += demo.buf.nextInt(14) + 1;
        if (hasFrac) value += demo.buf.nextInt(5) * (1 / (1 << 5));
        if (sign) value = -value;
      }
      return value;

    }
    if (
      baseProperty.hasFlag(DataTablePropertyFlag.CoordMp)
      || baseProperty.hasFlag(DataTablePropertyFlag.CoordMpLp)
      || baseProperty.hasFlag(DataTablePropertyFlag.CoordMpInt)
    ) {

      let value = 0;
      let sign = false;
      const inBounds = demo.buf.nextInt(1);
      if (baseProperty.hasFlag(DataTablePropertyFlag.CoordMpInt)) {
        if (demo.buf.nextInt(1)) {
          sign = !!demo.buf.nextInt(1);
          if (inBounds) value = demo.buf.nextInt(11) + 1;
          else value = demo.buf.nextInt(14) + 1;
        }
      } else {
        let intVal = demo.buf.nextInt(1);
        sign = !!demo.buf.nextInt(1);
        if (intVal) {
          if (inBounds) intVal = demo.buf.nextInt(11) + 1;
          else intVal = demo.buf.nextInt(14) + 1;
        }
        const lp = baseProperty.hasFlag(DataTablePropertyFlag.CoordMpLp);
        const fractVal = demo.buf.nextInt(lp ? 3 : 5);
        value = intVal + fractVal * (1 / (1 << (lp ? 3 : 5)));
      }
      if (sign) value = -value;
      return value;

    }
    if (
      baseProperty.hasFlag(DataTablePropertyFlag.NoScale)
    ) {

      return demo.buf.nextFloat();

    }
    if (
      baseProperty.hasFlag(DataTablePropertyFlag.Normal)
    ) {

      const sign = demo.buf.nextInt(1);
      let value = demo.buf.nextInt(11) * (1 / ((1 << 11) - 1));
      if (sign) value = -value;
      return value;

    }
    if (
      baseProperty.hasFlag(DataTablePropertyFlag.CellCoord)
      || baseProperty.hasFlag(DataTablePropertyFlag.CellCoordLp)
      || baseProperty.hasFlag(DataTablePropertyFlag.CellCoordInt)
    ) {

      let integer = demo.buf.nextInt(baseProperty.value.bits);
      if (baseProperty.hasFlag(DataTablePropertyFlag.CellCoordInt)) {
        return integer;
      }
      const lp = baseProperty.hasFlag(DataTablePropertyFlag.CellCoordLp);
      const fraction = demo.buf.nextInt(lp ? 3 : 5);
      return integer + fraction * (1 / (1 << (lp ? 3 : 5)));

    } else {

      const dwInterp = demo.buf.nextInt(baseProperty.value.bits);
      const value = dwInterp / ((1 << baseProperty.value.bits) - 1);
      return baseProperty.value.low + (baseProperty.value.high - baseProperty.value.low) * value;

    }
  }

  static decodeVector3 (demo: Demo, baseProperty: DataTableProperty): Vector {

    const vector = new Vector(
      EntityProperty.decodeFloat(demo, baseProperty),
      EntityProperty.decodeFloat(demo, baseProperty)
    );

    if (baseProperty.hasFlag(DataTablePropertyFlag.Normal)) {
      const sign = demo.buf.nextInt(1);
      const distSqr = vector.x * vector.x + vector.y * vector.y;
      if (distSqr < 1) vector.z = Math.sqrt(1 - distSqr);
      else vector.z = 0;
      if (sign) vector.z = -vector.z;
    } else {
      vector.z = EntityProperty.decodeFloat(demo, baseProperty);
    }

    return vector;
  }

  static decodeVector2 (demo: Demo, baseProperty: DataTableProperty): Vector {
    return new Vector(
      EntityProperty.decodeFloat(demo, baseProperty),
      EntityProperty.decodeFloat(demo, baseProperty)
    );
  }

  static decodeString (demo: Demo, baseProperty: DataTableProperty): string {
    const length = demo.buf.nextInt(9);
    return demo.buf.nextString(length * 8);
  }

  static decodeArray (
    demo: Demo,
    baseProperty: DataTableProperty,
    baseArrayProperty?: DataTableProperty
  ): number[] | string[] | Vector[] {

    if (typeof baseArrayProperty === "undefined") {
      throw "Invalid array property definition.";
    }
    if (typeof baseProperty.arrayElements === "undefined") {
      throw "Array property definition missing element count.";
    }

    const countBits = DemoBuffer.highestBitIndex(baseProperty.arrayElements) + 1;
    const count = demo.buf.nextInt(countBits);

    switch (baseArrayProperty.type) {

      case DataTablePropertyType.Int: {
        const array = [];
        for (let i = 0; i < count; i ++) {
          array.push(EntityProperty.decodeInt(demo, baseArrayProperty));
        }
        return array;
      }
      case DataTablePropertyType.Float: {
        const array = [];
        for (let i = 0; i < count; i ++) {
          array.push(EntityProperty.decodeFloat(demo, baseArrayProperty));
        }
        return array;
      }
      case DataTablePropertyType.String: {
        const array = [];
        for (let i = 0; i < count; i ++) {
          array.push(EntityProperty.decodeString(demo, baseArrayProperty));
        }
        return array;
      }
      case DataTablePropertyType.Vector3: {
        const array = [];
        for (let i = 0; i < count; i ++) {
          array.push(EntityProperty.decodeVector3(demo, baseArrayProperty));
        }
        return array;
      }
      case DataTablePropertyType.Vector2: {
        const array = [];
        for (let i = 0; i < count; i ++) {
          array.push(EntityProperty.decodeVector2(demo, baseArrayProperty));
        }
        return array;
      }

      default: throw `Unknown array property type ${baseArrayProperty.type}.`;
    }

  }

  setFromInt (demo: Demo, value: number, offset: number = 0): void {
    const baseProperty = this.property.baseProperty;
    if (baseProperty.type !== DataTablePropertyType.Int) {
      throw "Tried to call setFromInt on non-int property.";
    }

    if (baseProperty.hasFlag(DataTablePropertyFlag.Unsigned)) {
      demo.buf.setInt(this.bufferFrom + offset, this.bufferSize, value);
    } else {
      demo.buf.setSignedInt(this.bufferFrom + offset, this.bufferSize, value);
    }
  }

  copyArrayProperty (): EntityProperty {
    if (!Array.isArray(this.value)) throw "Tried to copy array of non-array property.";
    return new EntityProperty(this.index, this.property, this.bufferFrom, this.bufferSize, this.value.slice());
  }
  updateArrayProperty (other: EntityProperty): void {
    if (!Array.isArray(this.value)) throw "Tried to update array from non-array property.";
    if (!Array.isArray(other.value)) throw "Tried to update array of non-array property.";
    other.bufferFrom = this.bufferFrom;
    other.bufferSize = this.bufferSize;
    other.value = this.value.slice();
  }

  static readProperties (demo: Demo, flatProperties: FlatProperty[]): EntityProperty[] {
    const properties: EntityProperty[] = [];

    const newWay = !!demo.buf.nextInt(1);
    let i = -1;
    while ((i = demo.buf.nextFieldIndex(i, newWay)) !== -1) {
      if (i < 0 || i >= flatProperties.length) {
        console.warn("Overflowed expected entity property count.");
        return properties;
      }
      const flatProperty = flatProperties[i];
      if (!flatProperty) {
        console.warn("Expected property for entity not found.");
        return properties;
      }
      properties.push(EntityProperty.fromDemo(demo, i, flatProperty));
    }

    return properties;
  }

}

export class EntityBaseLine {

  public serverClass: ServerClass;
  public entityProperties: EntityProperty[];

  constructor (serverClass: ServerClass, entityProperties: EntityProperty[]) {
    this.serverClass = serverClass;
    this.entityProperties = entityProperties;
  }

  static updateBaseLine (
    demo: Demo,
    serverClass: ServerClass,
    entityProperties: EntityProperty[],
    flatPropertyCount: number
  ) {
    const id = serverClass.tableID;
    if (!demo.state.baselines[id]) {
      demo.state.baselines[id] = new EntityBaseLine(serverClass, new Array(flatPropertyCount));
    }
    const baseLine = demo.state.baselines[id];

    for (const from of entityProperties) {
      if (!from) continue;
      const to = baseLine.entityProperties[from.index];
      if (to && Array.isArray(to.value)) {
        from.updateArrayProperty(to);
      } else if (Array.isArray(from.value)) {
        baseLine.entityProperties[from.index] = from.copyArrayProperty();
      } else {
        baseLine.entityProperties[from.index] = from;
      }
    }
  }

}

export class EntityUpdate {
  public serverClass: ServerClass;
  constructor (serverClass: ServerClass) {
    this.serverClass = serverClass;
  }
}
export class EntityDelta extends EntityUpdate {
  public index: number;
  public properties: EntityProperty[];
  constructor (
    serverClass: ServerClass,
    index: number,
    properties: EntityProperty[]
  ) {
    super(serverClass);
    this.index = index;
    this.properties = properties;
  }
}
export class EntityEnterPVS extends EntityDelta {
  public serial: number;
  public isNew: boolean;
  constructor (
    serverClass: ServerClass,
    index: number,
    properties: EntityProperty[],
    serial: number,
    isNew: boolean
  ) {
    super(serverClass, index, properties);
    this.serial = serial;
    this.isNew = isNew;
  }
}
export class EntityLeavePVS extends EntityUpdate {
  public index: number;
  public doDelete: boolean;
  constructor (
    serverClass: ServerClass,
    index: number,
    doDelete: boolean
  ) {
    super(serverClass);
    this.index = index;
    this.doDelete = doDelete;
  }
}

export class Entity {

  public serverClass: ServerClass;
  public properties: EntityProperty[];
  public serial: number;
  public index: number;
  public inPVS: boolean;
  public source?: Demo;

  constructor (
    serverClass: ServerClass,
    properties: EntityProperty[],
    serial: number,
    index: number,
    inPVS: boolean,
    source?: Demo
  ) {
    this.serverClass = serverClass;
    this.properties = properties;
    this.serial = serial;
    this.index = index;
    this.inPVS = inPVS;
    this.source = source;
  }

  static fromBaseLine (demo: Demo, serverClass: ServerClass, serial: number, index: number): Entity {

    const tableID = serverClass.tableID;
    let baseline = demo.state.baselines[tableID];
    if (!baseline) {
      console.warn(`Missing baseline for "${serverClass.className}", creating blank.`);
      baseline = new EntityBaseLine(serverClass, []);
      demo.state.baselines[tableID] = baseline;
    }

    const entityProperties = baseline.entityProperties;
    const newProperties = new Array(entityProperties.length);

    for (let i = 0; i < entityProperties.length; i ++) {
      const property = entityProperties[i];
      if (property && Array.isArray(property.value)) {
        newProperties[i] = property.copyArrayProperty();
      } else {
        newProperties[i] = property;
      }
    }

    return new Entity(serverClass, newProperties, serial, index, true, demo);
  }

  static enterPVS (demo: Demo, update: EntityEnterPVS, updateBaseline: boolean): void {
    if (demo.state.baselines.length === 0) {
      throw "Tried to parse entity update without baselines.";
    }
    if (!demo.state.entities) {
      throw "Tried to parse entity update without entities.";
    }

    let entity;
    if (update.isNew) {
      entity = Entity.fromBaseLine(demo, update.serverClass, update.serial, update.index);
      demo.state.entities[update.index] = entity;
    } else {
      entity = demo.state.entities[update.index];
    }
    if (!entity) {
      console.warn(`Untracked entity "${update.serverClass.className}" entered PVS, index ${update.index}.`);
      return;
    }

    entity.inPVS = true;
    Entity.applyDelta(demo, update);

    if (updateBaseline) {
      EntityBaseLine.updateBaseLine(demo, update.serverClass, entity.properties, entity.properties.length);
    }
  }

  static leavePVS (demo: Demo, update: EntityLeavePVS): void {
    if (!demo.state.entities) {
      throw "Tried to parse entity update without entities.";
    }
    if (update.doDelete) {
      delete demo.state.entities[update.index];
    } else {
      const entity = demo.state.entities[update.index];
      if (entity) entity.inPVS = false;
    }
  }

  static applyDelta (demo: Demo, delta: EntityDelta): void {
    if (!demo.state.entities) {
      throw "Tried to parse entity update without entities.";
    }
    const entity = demo.state.entities[delta.index];
    if (!entity) {
      throw "Tried to apply delta to non-existent entity.";
    }

    for (const property of delta.properties) {
      const oldProperty = entity.properties[property.index];
      if (property && Array.isArray(property.value)) {
        if (!oldProperty) {
          entity.properties[property.index] = property.copyArrayProperty();
        } else {
          property.updateArrayProperty(oldProperty);
        }
      } else {
        entity.properties[property.index] = property;
      }
    }
  }

  static parseHandle (handle: number): { index: number, serial: number } {
    return {
      index: handle & ((1 << 11) - 1),
      serial: handle >> 11
    };
  }
  getHandle (): number {
    return (this.serial << 11) | this.index;
  }

  // Imitations of VScript entity methods

  GetProperties (): Map<string, EntityPropertyValueType> {
    return new Map(this.properties
      .filter(p => p)
      .map(p => [p.property.name, p.value])
    );
  }

  GetProperty (name: string): EntityPropertyValueType | null {
    const property = this.properties.find(p => p &&
      p.property.name === name
    );
    if (!property) return null;
    return property.value;
  }

  GetOrigin (): Vector {
    const parent = this.GetMoveParent();
    const parentOrigin = parent ? parent.GetOrigin() : new Vector();

    let origin = this.GetProperty("m_vecOrigin");
    if (!(origin instanceof Vector)) {
      origin = this.GetProperty("portallocaldata.m_vecOrigin");
      if (!(origin instanceof Vector)) {
        return new Vector();
      }
      origin.z = Number(this.GetProperty("portallocaldata.m_vecOrigin[2]")) || 0;
      return origin;
    }

    const cellPosition = new Vector(
      Number(this.GetProperty("m_cellX")),
      Number(this.GetProperty("m_cellY")),
      Number(this.GetProperty("m_cellZ"))
    ).Sub(new Vector(512, 512, 512)).Scale(32);

    return origin.Add(cellPosition).Add(parentOrigin);
  }

  GetAngles (): Vector {
    const angles = this.GetProperty("m_angRotation");
    if (angles instanceof Vector) {
      return angles.Clone();
    }
    const pitch = this.GetProperty("m_angEyeAngles[0]");
    const yaw = this.GetProperty("m_angEyeAngles[1]");
    if (typeof pitch !== "number" || typeof yaw !== "number") {
      return new Vector();
    }
    return new Vector(pitch, yaw);
  }

  GetVelocity (): Vector {
    return new Vector(
      Number(this.GetProperty("localdata.m_vecVelocity[0]")),
      Number(this.GetProperty("localdata.m_vecVelocity[1]")),
      Number(this.GetProperty("localdata.m_vecVelocity[2]"))
    );
  }

  GetBoundingMins (): Vector {
    const vector = this.GetProperty("m_Collision.m_vecMins");
    if (vector instanceof Vector) return vector;
    return new Vector();
  }
  GetBoundingMaxs(): Vector {
    const vector = this.GetProperty("m_Collision.m_vecMaxs");
    if (vector instanceof Vector) return vector;
    return new Vector();
  }

  GetCenter (): Vector {
    const origin = this.GetOrigin();
    const mins = this.GetBoundingMins();
    const maxs = this.GetBoundingMaxs();
    const localCenter = mins.Add(maxs).Scale(0.5);
    return origin.Add(localCenter);
  }

  GetName (): string {
    const targetname = this.GetProperty("m_iName");
    if (typeof targetname !== "string") return "";
    return targetname;
  }
  GetClassname (): string {
    const classname = this.GetProperty("m_iSignifierName");
    if (typeof classname !== "string") return this.serverClass.className;
    return classname;
  }
  GetModelName (): string {
    const models = this.source?.state.stringTables?.get("modelprecache");
    if (!models) return "";
    const modelIndex = this.GetProperty("m_nModelIndex");
    if (typeof modelIndex !== "number") return "";
    const modelName = models.entries[modelIndex]?.entryName;
    return modelName || "";
  }

  GetHealth (): number {
    const health = this.GetProperty("m_iHealth");
    if (typeof health !== "number") return -1;
    return health;
  }
  GetTeam (): number {
    const team = this.GetProperty("m_iTeamNum");
    if (typeof team !== "number") return -1;
    return team;
  }

  GetMoveParent (): Entity | null {
    const entities = this.source?.state.entities;
    if (!entities) return null;
    const parentHandle = this.GetProperty("moveparent");
    if (typeof parentHandle !== "number") return null;
    const { index } = Entity.parseHandle(parentHandle);
    return entities[index] || null;
  }
  GetOwner (): Entity | null {
    const entities = this.source?.state.entities;
    if (!entities) return null;
    const ownerHandle = this.GetProperty("m_hOwnerEntity");
    if (typeof ownerHandle !== "number") return null;
    const { index } = Entity.parseHandle(ownerHandle);
    return entities[index] || null;
  }
  GetRootMoveParent (): Entity | null {
    let output = null;
    let nextParent;
    while (nextParent = this.GetMoveParent()) {
      output = nextParent;
    }
    return output;
  }
  FirstMoveChild (): Entity | null {
    const entities = this.source?.state.entities;
    if (!entities) return null;
    return entities.find(e => e && e.GetMoveParent() === this) || null;
  }
  NextMovePeer (): Entity | null {
    const entities = this.source?.state.entities;
    if (!entities) return null;
    const parent = this.GetMoveParent();
    if (!parent) return null;
    let found = false;
    for (const entity of entities) {
      if (!entity) continue;
      if (entity === this) {
        found = true;
        continue;
      } else if (!found) {
        continue;
      }
      if (entity.GetMoveParent() === parent) {
        return entity;
      }
    }
    return null;
  }

  IsValid (): boolean {
    const entities = this.source?.state.entities;
    if (!entities) return false;
    return entities[this.index] === this;
  }
  entindex (): number {
    return this.index;
  }

}

// Imitation of VScript `Entities` global, also acts as an array
export class Entities extends Array<Entity> {

  constructor(arg?: number | Entity[]) {
    if (typeof arg === "number") super(arg);
    else if (Array.isArray(arg)) super(...arg);
    else super();
  }

  FindByCallback (start: Entity | null, callback: (entity: Entity) => boolean): Entity | null {
    const startIndex = start ? (start.index + 1) : 0;
    for (let i = startIndex; i < this.length; i++) {
      const current = this[i];
      if (!current) continue;
      if (callback(current)) return current;
    }
    return null;
  }

  FindByProperty (start: Entity | null, key: string, value: EntityPropertyValueType): Entity | null {
    return this.FindByCallback(start, (current: Entity) => {
      return current.properties.some(p => p &&
        p.property.name === key &&
        p.value === value
      );
    })
  };
  FindByPropertyAll (key: string, value: EntityPropertyValueType): Entities {
    return new Entities(this.filter(e => e &&
      e.properties.some(p => p &&
        p.property.name === key &&
        p.value === value
      )
    ));
  };

  FindByClassname (start: Entity | null, classname: string): Entity | null {
    return this.FindByCallback(start, (current: Entity) =>
      current.serverClass.className === classname
      || current.properties.some(p => p &&
        p.property.name === "m_iSignifierName" &&
        p.value === classname
      )
    );
  };
  FindByClassnameAll (classname: string): Entities {
    return new Entities(this.filter(e => e && (
      e.serverClass.className === classname
      || e.properties.some(p => p &&
        p.property.name === "m_iSignifierName" &&
        p.value === classname
      )
    )));
  }

  FindByName (start: Entity | null, targetname: string): Entity | null {
    return this.FindByProperty(start, "m_iName", targetname);
  };
  FindByNameAll (targetname: string): Entities {
    return this.FindByPropertyAll("m_iName", targetname);
  }

  FindByTarget (start: Entity | null, targetname: string): Entity | null {
    const target = this.FindByName(null, targetname);
    if (!target) return null;
    return this.FindByProperty(start, "m_hTargetEntity", target.getHandle());
  };
  FindByTargetAll (targetname: string): Entities {
    const target = this.FindByName(null, targetname);
    if (!target) return new Entities();
    return this.FindByPropertyAll("m_hTargetEntity", target.getHandle());
  }

  FindByModel (start: Entity | null, model: string): Entity | null {
    const normalizedModel = model.replaceAll("\\", "/");
    return this.FindByCallback(start, (current: Entity) => {
      const currentModel = current.GetModelName().replaceAll("\\", "/");
      return normalizedModel === currentModel;
    });
  };
  FindByModelAll (model: string): Entities {
    const normalizedModel = model.replaceAll("\\", "/");
    return new Entities(this.filter(e => e &&
      e.GetModelName().replaceAll("\\", "/") === normalizedModel
    ));
  }

  ArrayFindNearest (entities: Entity[], location: Vector, radius: number): Entity | null {
    const radiusSqr = radius * radius;
    let nearest = entities[0];
    if (!nearest) return null;
    let distance = nearest.GetOrigin().Sub(location).LengthSqr();
    for (let i = 1; i < entities.length; i ++) {
      const curr = entities[i];
      if (!curr) continue;
      const currDistance = curr.GetOrigin().Sub(location).LengthSqr();
      if (currDistance > radiusSqr) continue;
      if (currDistance < distance) {
        nearest = curr;
        distance = currDistance;
      }
    }
    if (distance > radiusSqr) return null;
    return nearest || null;
  }
  ArrayFindWithinAll (entities: Entity[], location: Vector, radius: number): Entities {
    const radiusSqr = radius * radius;
    return new Entities(entities.filter(e => e &&
      e.GetOrigin().Sub(location).LengthSqr() <= radiusSqr
    ));
  }
  ArrayFindWithin (entities: Entities, start: Entity | null, location: Vector, radius: number): Entity | null {
    const radiusSqr = radius * radius;
    return entities.FindByCallback(start, (current: Entity) => {
      return current.GetOrigin().Sub(location).LengthSqr() < radiusSqr;
    });
  }

  FindByClassnameNearest (classname: string, location: Vector, radius: number): Entity | null {
    const allOfClass = this.FindByClassnameAll(classname);
    return this.ArrayFindNearest(allOfClass, location, radius);
  }
  FindByNameNearest (targetname: string, location: Vector, radius: number): Entity | null {
    const allOfName = this.FindByNameAll(targetname);
    return this.ArrayFindNearest(allOfName, location, radius);
  }

  FindByClassnameWithinAll (classname: string, location: Vector, radius: number): Entities {
    const allOfClass = this.FindByClassnameAll(classname);
    return this.ArrayFindWithinAll(allOfClass, location, radius);
  }
  FindByNameWithinAll (targetname: string, location: Vector, radius: number): Entities {
    const allOfName = this.FindByNameAll(targetname);
    return this.ArrayFindWithinAll(allOfName, location, radius);
  }
  FindByClassnameWithin (start: Entity | null, classname: string, location: Vector, radius: number): Entity | null {
    const allOfClass = this.FindByClassnameAll(classname);
    return this.ArrayFindWithin(allOfClass, start, location, radius);
  }
  FindByNameWithin (start: Entity | null, targetname: string, location: Vector, radius: number): Entity | null {
    const allOfName = this.FindByNameAll(targetname);
    return this.ArrayFindWithin(allOfName, start, location, radius);
  }
  FindInSphereAll (location: Vector, radius: number): Entities {
    return this.ArrayFindWithinAll(this, location, radius);
  }
  FindInSphere (start: Entity | null, location: Vector, radius: number): Entity | null {
    return this.ArrayFindWithin(this, start, location, radius);
  }

}
