import assert from "node:assert/strict";
import test from "node:test";

import { insideGeofence } from "@/lib/hr/geo";
import {
  assertConfirmed,
  assertNoSelfApproval,
  assertPayrollMutable,
} from "@/lib/hr/services/operation-guards";
import { HrError } from "@/lib/hr/errors";

test("operational mutations require an explicit confirmation", () => {
  assert.throws(() => assertConfirmed(false), HrError);
  assert.doesNotThrow(() => assertConfirmed(true));
});

test("self approval is blocked by default", () => {
  assert.throws(() => assertNoSelfApproval("actor-id", "actor-id"), HrError);
  assert.doesNotThrow(() => assertNoSelfApproval("actor-id", "actor-id", false));
});

test("inaccurate and out-of-fence clock readings are rejected", () => {
  assert.equal(insideGeofence({ latitude: 13.7563, longitude: 100.5018 }, { latitude: 13.7563, longitude: 100.5018, accuracyMeters: 101 }, 50).accepted, false);
  assert.equal(insideGeofence({ latitude: 13.7563, longitude: 100.5018 }, { latitude: 13.8, longitude: 100.5, accuracyMeters: 5 }, 50).accepted, false);
});

test("approved payroll snapshots cannot be recalculated", () => {
  assert.throws(() => assertPayrollMutable("APPROVED"), HrError);
  assert.doesNotThrow(() => assertPayrollMutable("REVIEW"));
});
