import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_FACE_MATCH_THRESHOLD,
  FACE_DESCRIPTOR_LENGTH,
  euclideanDistance,
  findDuplicateFaceInOrganization,
  isFaceMatch,
  isFaceMatchMode,
  parseFaceDescriptor,
} from "../src/lib/hr/face-match";

function zeros(): number[] {
  return Array.from({ length: FACE_DESCRIPTOR_LENGTH }, () => 0);
}

function ones(): number[] {
  return Array.from({ length: FACE_DESCRIPTOR_LENGTH }, () => 1);
}

function almostZeros(): number[] {
  return Array.from({ length: FACE_DESCRIPTOR_LENGTH }, (_, i) =>
    i === 0 ? 0.01 : 0,
  );
}

describe("face-match", () => {
  it("accepts OFF|WARN|REQUIRE modes", () => {
    assert.equal(isFaceMatchMode("OFF"), true);
    assert.equal(isFaceMatchMode("WARN"), true);
    assert.equal(isFaceMatchMode("REQUIRE"), true);
    assert.equal(isFaceMatchMode("STRICT"), false);
  });

  it("parses 128-d descriptors only", () => {
    assert.ok(parseFaceDescriptor(zeros()));
    assert.equal(parseFaceDescriptor([1, 2, 3]), null);
    assert.equal(parseFaceDescriptor("nope"), null);
  });

  it("parses JSON string and array-like objects from JSONB drivers", () => {
    assert.ok(parseFaceDescriptor(JSON.stringify(zeros())));
    const asObject: Record<string, number> = {};
    for (let i = 0; i < FACE_DESCRIPTOR_LENGTH; i += 1) asObject[String(i)] = 0;
    assert.ok(parseFaceDescriptor(asObject));
  });

  it("computes euclidean distance and match threshold", () => {
    const a = zeros();
    const b = ones();
    const distance = euclideanDistance(a, b);
    assert.ok(Math.abs(distance - Math.sqrt(FACE_DESCRIPTOR_LENGTH)) < 1e-9);
    assert.equal(isFaceMatch(0.4, DEFAULT_FACE_MATCH_THRESHOLD), true);
    assert.equal(isFaceMatch(0.9, DEFAULT_FACE_MATCH_THRESHOLD), false);
    assert.equal(isFaceMatch(euclideanDistance(a, a)), true);
  });

  it("blocks duplicate faces only inside the same organization", () => {
    const face = almostZeros();
    const duplicate = findDuplicateFaceInOrganization({
      organizationId: "org-b",
      exceptEmployeeId: "emp-b",
      descriptor: face,
      threshold: DEFAULT_FACE_MATCH_THRESHOLD,
      candidates: [
        {
          employeeId: "emp-a",
          organizationId: "org-a",
          descriptor: face,
        },
        {
          employeeId: "emp-other-b",
          organizationId: "org-b",
          descriptor: ones(),
        },
      ],
    });
    assert.equal(duplicate, null);
  });

  it("detects duplicate when another employee in the same org matches", () => {
    const face = almostZeros();
    const duplicate = findDuplicateFaceInOrganization({
      organizationId: "org-b",
      exceptEmployeeId: "emp-b",
      descriptor: face,
      threshold: DEFAULT_FACE_MATCH_THRESHOLD,
      candidates: [
        {
          employeeId: "emp-a",
          organizationId: "org-a",
          descriptor: face,
        },
        {
          employeeId: "emp-other-b",
          organizationId: "org-b",
          descriptor: face,
        },
      ],
    });
    assert.ok(duplicate);
    assert.equal(duplicate.employeeId, "emp-other-b");
  });

  it("ignores self employee even if candidate list includes them", () => {
    const face = zeros();
    const duplicate = findDuplicateFaceInOrganization({
      organizationId: "org-a",
      exceptEmployeeId: "emp-a",
      descriptor: face,
      threshold: DEFAULT_FACE_MATCH_THRESHOLD,
      candidates: [
        {
          employeeId: "emp-a",
          organizationId: "org-a",
          descriptor: face,
        },
      ],
    });
    assert.equal(duplicate, null);
  });
});
