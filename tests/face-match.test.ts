import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_FACE_MATCH_THRESHOLD,
  FACE_DESCRIPTOR_LENGTH,
  euclideanDistance,
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

  it("computes euclidean distance and match threshold", () => {
    const a = zeros();
    const b = ones();
    const distance = euclideanDistance(a, b);
    assert.ok(Math.abs(distance - Math.sqrt(FACE_DESCRIPTOR_LENGTH)) < 1e-9);
    assert.equal(isFaceMatch(0.4, DEFAULT_FACE_MATCH_THRESHOLD), true);
    assert.equal(isFaceMatch(0.9, DEFAULT_FACE_MATCH_THRESHOLD), false);
    assert.equal(isFaceMatch(euclideanDistance(a, a)), true);
  });
});
