import { existsSync, readFileSync } from "fs";
import { Demo } from "./sppd/Demo.js";

if (typeof process.argv[2] !== "string") {
  console.log("Usage: test.js <file.dem>");
  process.exit(1);
}

const demoFilePath: string = process.argv[2];

if (!existsSync(demoFilePath)) {
  console.error(`File not found: "${demoFilePath}"`);
  process.exit(1);
}

// Called once per server tick (30 TPS in SP)
const tickHandler = (demo: Demo): boolean => {

  // Check if entities have loaded yet
  const { entities } = demo.state;
  if (!entities) return true;

  // Find the first cube by classname and print its position
  const cube = entities.FindByClassname(null, "prop_weighted_cube");
  if (cube) console.log(cube.GetOrigin()?.ToKVString());

  return true; // Continue parsing
};

let jumps: number = 0;
const commandHandler = (demo: Demo, command: string): boolean => {

  // Count "+jump" commands
  if (command.startsWith("+jump")) {
    jumps ++;
  }

  return true; // Continue parsing
};

const finishHandler = (demo: Demo, success: boolean): void => {
  console.log(`Parsing finished ${success ? "" : "un"}successfully!`);
  // Print the amount of jumps counted throughout the demo
  console.log(jumps, "jumps");
};

const demoBytes: Uint8Array = readFileSync(demoFilePath);
const demo: Demo = new Demo(demoBytes, {
  onTick: tickHandler,
  onCommand: commandHandler,
  onFinish: finishHandler
});

// Immediately after constructing, "demo" contains just the header:
console.log(demo.clientName, "on map", demo.mapName);
