require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "node",
  },
});

const assert = require("node:assert/strict");

const {
  CHECK_CONSTRAINED_CENTRELINK_DETAIL_FIELDS,
  CHECK_CONSTRAINED_ESTATE_BENEFICIARY_FIELDS,
  CHECK_CONSTRAINED_ESTATE_EXECUTOR_FIELDS,
  CHECK_CONSTRAINED_HOUSEHOLD_MEMBER_FIELDS,
  CHECK_CONSTRAINED_PERSON_FIELDS,
  CHECK_CONSTRAINED_POWER_OF_ATTORNEY_FIELDS,
  CHECK_CONSTRAINED_PROFESSIONAL_RELATIONSHIP_FIELDS,
  CHECK_CONSTRAINED_SUPER_PENSION_ACCOUNT_FIELDS,
  coerceEmptyToNull,
} = require("../src/lib/input-coercion.ts");

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

assert.ok(CHECK_CONSTRAINED_PERSON_FIELDS.includes("resident_status"));
assert.ok(CHECK_CONSTRAINED_PERSON_FIELDS.includes("tax_resident_status"));
assert.ok(CHECK_CONSTRAINED_PERSON_FIELDS.includes("funeral_plan_status"));
assert.ok(CHECK_CONSTRAINED_HOUSEHOLD_MEMBER_FIELDS.includes("relation"));
assert.ok(CHECK_CONSTRAINED_HOUSEHOLD_MEMBER_FIELDS.includes("role_in_household"));
assert.ok(CHECK_CONSTRAINED_CENTRELINK_DETAIL_FIELDS.includes("benefit_type"));
assert.ok(CHECK_CONSTRAINED_CENTRELINK_DETAIL_FIELDS.includes("concession_card_type"));
assert.equal(CHECK_CONSTRAINED_PROFESSIONAL_RELATIONSHIP_FIELDS.length, 0);
assert.equal(CHECK_CONSTRAINED_ESTATE_BENEFICIARY_FIELDS.length, 0);
assert.equal(CHECK_CONSTRAINED_ESTATE_EXECUTOR_FIELDS.length, 0);
assert.equal(CHECK_CONSTRAINED_POWER_OF_ATTORNEY_FIELDS.length, 0);
assert.ok(CHECK_CONSTRAINED_SUPER_PENSION_ACCOUNT_FIELDS.includes("beneficiary_nomination_type"));

console.log("ok - Round 2 coercion constants include nullable fields and leave NOT NULL fields to route validation");
