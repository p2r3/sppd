## SPPD
Scriptable Parser for Portal 2 Demos. Name chosen specifically to be confused with [Spinning Player Physics Deformation](https://wiki.portal2.sr/Player_Physics_Deformation).

This parser enables you to interact with a demo as it's being parsed. In other words, it lets you write scripts to track changes in the game world during simulated demo playback. Compatible only with Portal 2.

Here's a simple example that logs the position of a cube over time:
```ts
const demoBytes: Uint8Array = readFileSync(demoFilePath);
const demo: Demo = new Demo(demoBytes, { onTick: (demo) => {
  // Called once per server tick (30 TPS in SP)

  // Check if entities have loaded yet
  const { entities } = demo.state;
  if (!entities) return;

  // Find the first cube by classname and print its position
  const cube = entities.FindByClassname(null, "prop_weighted_cube");
  if (cube) console.log(cube.GetOrigin()?.ToKVString());

}});
```
The entity interface is deliberately shaped like the VScript API to make it more familiar to those who've scripted for Portal 2 before. For more details, see the [documentation](DOCUMENTATION.md).

## Acknowledgements
- [**UntitledParser**](https://github.com/UncraftedName/UntitledParser) - most of the entity handling code is derived from here.
- [**dem.nekz.me**](https://dem.nekz.me/) - guided the initial program layout and message parsing.
- [**mlugg**](https://github.com/mlugg) - for consulting on a different project, which indirectly inspired this one.
