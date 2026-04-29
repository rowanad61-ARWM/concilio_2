require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const assert = require("node:assert/strict");

const { coerceEmptyToNull } = require("../src/lib/input-coercion.ts");

const input = {
  empty: "",
  value: "value",
  nullish: null,
  undef: undefined,
  untouched: "",
};

const output = coerceEmptyToNull(input, [
  "empty",
  "value",
  "nullish",
  "undef",
  "missing",
]);

assert.notEqual(output, input);
assert.equal(output.empty, null);
assert.equal(output.value, "value");
assert.equal(output.nullish, null);
assert.equal(output.undef, undefined);
assert.equal(Object.prototype.hasOwnProperty.call(output, "missing"), false);
assert.equal(output.untouched, "");
assert.equal(input.empty, "");

console.log("ok - coerceEmptyToNull only converts named empty strings");
