import { existsSync, readFileSync } from "fs";
import { Demo } from "./sppd/Demo.ts";

if (typeof process.argv[2] !== "string") {
  console.log("Usage: test.js <file.dem>");
  process.exit(1);
}

const demoFilePath: string = process.argv[2];

if (!existsSync(demoFilePath)) {
  console.error(`File not found: "${demoFilePath}"`);
  process.exit(1);
}

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

// Do something with `demo` after parsing...
