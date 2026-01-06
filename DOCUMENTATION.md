## SPPD Documentation

### Prerequisites

At minimum, SPPD requires just one import:
```ts
import { Demo } from "./sppd/Demo.ts";
```
Most of the other stuff is internal, though you may also want to import the `Vector` class:
```ts
import { Vector } from "./sppd/Vector.ts";
```

This vector implementation, just like the entity interface, should look and feel very similar to that found in Portal 2's VScript. The main difference is the lack of operator overloading (or "metamethods" in Squirrel terms). The alternatives are:
- `Sum (other: Vector)` - addition;
- `Sub (other: Vector)` - subtraction;
- `Scale (factor: number)` - multiplication;
- `Clone ()` - deep cloning.

### The `Demo` class

The `Demo` constructor takes two arguments:
  - a `Uint8Array` with the demo file;
  - an object of optional event handlers, listed in the example below:
```ts
const demoBytes: Uint8Array = readFileSync("path/to/demo.dem");
const demo: Demo = new Demo(demoBytes, {
  // Called once per server tick
  onTick: (demo: Demo): void => { },
  // Called on every console command
  onCommand: (demo: Demo, command: string): void => { }
});
```
Parsing starts and ends with the constructor, so accessing the object outside of any event handlers will yield its final state.

Here's a rough map of the `Demo` object:
- Header:
  - `demoFileStamp: string`
  - `demoProtocol: number`
  - `networkProtocol: number`
  - `serverName: string`
  - `clientName: string`
  - `mapName: string`
  - `gameDirectory: string`
  - `playbackTime: number`
  - `playbackTicks: number`
  - `playbackFrames: number`
  - `signOnLength: number`
- Parsed data:
  - `messages: Message[]`
  - `state: DemoState`
    - `tick: number`
    - `players: CmdInfo[]`
    - `entities: Entities`
- Internal data:
  - `buf: DemoBuffer`
  - `dataTables: DataTable[]`
  - `stringTables: Map<string, StringTable>`
  - `serverClasses: ServerClass[]`
  - `parserClasses: ParserClass[]`
  - `baselines: EntityBaseLine[]`

Surface-level information can be gathered from the header, or by looking through the `messages`. However, for more interactive demo analysis, you'll probably want to use `state.entities` from within the `onTick` event handler to interact with in-game objects.

### Entity interface

The entity interface is designed to mimick Portal 2's VScript as closely as possible. Because of this, the [VDC "List of Portal 2 Script Functions"](https://developer.valvesoftware.com/wiki/Portal_2/Scripting/Script_Functions) works as a complimentary documentation to this one.

Below are a few examples to help you get a feel for what it's like to work with this system. Again, if you've used VScript before, this should feel familiar.

#### Reading properties

Printing the positions and angles of all cubes on every tick:
```js
new Demo(demoBytes, { onTick: (demo) => {
  // Ensure that entities have loaded
  const { entities } = demo.state;
  if (!entities) return;

  // Iterate through all cubes
  let ent = null;
  while (ent = entities.FindByClassname(ent, "prop_weighted_cube")) {
    // Print positions and angles
    const pos = ent.GetOrigin();
    const ang = ent.GetAngles();
    console.log(pos + " " + ang);
  }

}});
```

Logging the position of the blue portal starting from tick 1000:
```js
new Demo(demoBytes, { onTick: (demo) => {
  // Don't do anything until tick 1000
  if (demo.state.tick < 1000) return;

  // Ensure that entities have loaded
  const { entities } = demo.state;
  if (!entities) return;

  // Find the blue portal entity by using its model
  const portal = entities.FindByModel(null, "models/portals/portal1.mdl");
  if (portal) console.log(portal.GetOrigin().toString());

}});
```

You can also read arbitrary properties like so:
```js
  entity.GetProperty("m_CollisionGroup");
```
And to retrieve a `Map` of all available properties and their values:
```js
  entity.GetProperties(); // Returns Map<name, value>
```

#### Modifying properties

This parser also lets you _modify_ properties to an extent, effectively letting you edit a demo after it has been recorded. This feature is still very primitive and thus comes with some limitations, namely:
- Some properties have a fixed range or reduced precision, and others cannot be changed at all.
- New deltas aren't created, which means that you cannot animate a prop that's standing still.

To check if a value has been modified successfully, read the return value of the setter function. If `true`, the property was found and the value was set. Even then, it still might not be entirely accurate to your input due to the limitations above.

Note that changes to entity properties are only applied to the buffer, and are _not_ reflected by the parser. To see the factual value of a property after a change, you'll have to parse the demo a second time. This is intentional, as otherwise you'd have to manually keep track of deltas to make relative changes.

Here's an example that rotates every entity 45 degrees on the roll axis:
```js
const demo = new Demo(demoBytes, { onTick: (demo) => {
  // Ensure that entities have loaded
  const { entities } = demo.state;
  if (!entities) return;

  // Iterate through all entities
  let ent = entities.First();
  while (ent = entities.Next(ent)) {
    // Get current angles
    const ang = ent.GetAngles();
    // Set roll to 45 degrees, keeping the rest the same
    ent.SetAngles(ang.x, ang.y, 45);
    // Note: this will still be false!!
    ent.GetAngles().z === 45;
  }

}});

// Get the modified demo buffer
const u8array = demo.buf.bytes;
// Export it to a file
fs.writeFileSync("output.dem", u8array);
```

Resizing floor buttons to Pi times their original size:
```js
const demo = new Demo(demoBytes, { onTick: (demo) => {
  // Ensure that entities have loaded
  const { entities } = demo.state;
  if (!entities) return;

  // Iterate through all floor buttons
  let ent = null;
  while (ent = entities.FindByClassname(ent, "prop_floor_button")) {
    // Set the model scale property (only works on certain models)
    ent.SetProperty("m_flModelScale", Math.PI);
  }
  while (ent = entities.FindByClassname(ent, "prop_under_floor_button")) {
    ent.SetProperty("m_flModelScale", Math.PI);
  }

}});

fs.writeFileSync("output.dem", demo.buf.bytes);
```

Swapping cube models with security cameras:
```js
entities.FindByClassnameAll("prop_weighted_cube").forEach(cube => {
  const success = cube.SetModel("models/props/security_camera.mdl");
  // `success` is false if the model isn't precached
  if (!success) console.warn(`Failed to set model on tick ${demo.state.tick}.`);
});
```

#### Miscellaneous quirks

- The `entities` object can also be accessed like a regular array. It contains all entities, indexed by their entindex:
```js
  // Index 1 is always the player
  const player = demo.state.entities[1];
```
- Every search function (except for `FindBy...Nearest`) has an "All" variant that omits the first argument, and returns an _array_ of matches:
```js
  // Returns an array of cube entities
  const cubes = entities.FindByClassnameAll("prop_weighted_cube");
```
- `GetClassname` may return the _server_ class name (e.g. CBaseViewModel) when the prettier "signifier name" is not available. Consequently, searching by classname with `FindByClassname` or similar will include results for matching server class names.

### Messages

Demo messages are available via the `demo.messages` array. Net/Svc messages are stored within their respective Packet/SignOn messages.

Here's an example that counts the amount of times the `+jump` commmand was called:
```js
import { Demo } from "./sppd/Demo.ts";
import { ConsoleCmdMessage } from "./sppd/Message.ts";

const demo = new Demo(demoBytes);

const jumps = demo.messages.filter(message =>
  message instanceof ConsoleCmdMessage
  && message.command.startsWith("+jump")
);
console.log(jumps.length);
```

And here's an example that prints the operating system of the server (yes, demos store that for some reason):
```js
import { Demo } from "./sppd/Demo.ts";
import { PacketMessage } from "./sppd/Message.ts";
import { SvcServerInfo } from "./sppd/NetSvcMessage.ts";

const demo = new Demo(demoBytes);

for (const message of demo.messages) {
  if (!(message instanceof PacketMessage)) continue;
  const serverInfo = message.messages.find(m => m instanceof SvcServerInfo);
  if (serverInfo) {
    console.log(serverInfo.serverOS === "w" ? "Windows" : "Linux");
    break;
  }
}
```
