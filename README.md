## SPPD
Scriptable Parser for Portal 2 Demos. Name chosen specifically to be confused with [Spinning Player Physics Deformation](https://wiki.portal2.sr/Player_Physics_Deformation).

This parser enables you to interact with a demo as it's being parsed. In other words, it lets you write scripts to track changes in the game world during simulated demo playback. Compatible only with Portal 2.

Here's a simple example that logs the position of a cube over time:
```ts
const demoBytes: Uint8Array = readFileSync(demoFilePath);
const demo: Demo = new Demo(demoBytes, (demo) => {
  // Called once per server tick (30 TPS in SP)

  // Check if entities have loaded yet
  const { entities } = demo.state;
  if (!entities) return;

  // Find the first cube by classname and print its position
  const cube = entities.FindByClassname(null, "prop_weighted_cube");
  if (cube) console.log(cube.GetOrigin()?.ToKVString());

});
```
The entity interface is deliberately shaped like the VScript API to make it more familiar to those who've scripted for Portal 2 before. That said, there are a few key differences:
- For obvious reasons, only getter methods are exposed. However, I do think it would be interesting to allow for modifying the demo this way. I might look into that.
- `GetClassname` may return the _server_ class name (e.g. CBaseViewModel) when the prettier "signifier name" is not available.
- Consequently, searching by classname with `FindByClassname` or similar will include results for matching server class names.
- The `demo.state.entities` object can be handled like a typical array, and contains all entities that exist on the current tick, indexed by their entindex.
- Every search function (except for `FindBy...Nearest`) has an "All" variant that omits the first argument, and returns an _array_ of matches. For example, `FindByNameAll` will return an array of entities that match the given targetname.

Because of the similarity to VScript, you can somewhat apply the [VDC "List of Portal 2 Script Functions"](https://developer.valvesoftware.com/wiki/Portal_2/Scripting/Script_Functions) here, too.

## Acknowledgements
- [**UntitledParser**](https://github.com/UncraftedName/UntitledParser) - most of the entity handling code is derived from here.
- [**dem.nekz.me**](https://dem.nekz.me/) - guided the initial program layout and message parsing.
- **mlugg** - for consulting on a different project, which indirectly inspired this one.
