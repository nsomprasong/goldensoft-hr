import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contactsMatchByEmailOrPhone,
  normalizeEmailForCompare,
  normalizePhoneForCompare,
} from "../src/lib/hr/contact-identity";
import {
  DEFAULT_FACE_MATCH_THRESHOLD,
  FACE_DESCRIPTOR_LENGTH,
  findDuplicateFaceInOrganization,
} from "../src/lib/hr/face-match";

function faceA(): number[] {
  return Array.from({ length: FACE_DESCRIPTOR_LENGTH }, (_, i) =>
    i === 0 ? 0.02 : 0,
  );
}

describe("contact-identity", () => {
  it("normalizes email case", () => {
    assert.equal(normalizeEmailForCompare("A@Ex.Com"), "a@ex.com");
    assert.equal(normalizeEmailForCompare("  "), null);
  });

  it("normalizes Thai phone variants", () => {
    assert.equal(normalizePhoneForCompare("081-234-5678"), "0812345678");
    assert.equal(normalizePhoneForCompare("+66812345678"), "0812345678");
  });

  it("matches by email or phone", () => {
    assert.equal(
      contactsMatchByEmailOrPhone(
        { email: "a@ex.com", phone: "0811111111" },
        { email: "A@ex.com", phone: "0822222222" },
      ),
      true,
    );
    assert.equal(
      contactsMatchByEmailOrPhone(
        { email: "a@ex.com", phone: "081-234-5678" },
        { email: "b@ex.com", phone: "+66812345678" },
      ),
      true,
    );
    assert.equal(
      contactsMatchByEmailOrPhone(
        { email: "a@ex.com", phone: "0811111111" },
        { email: "b@ex.com", phone: "0822222222" },
      ),
      false,
    );
  });
});

describe("same-org face + contact rule", () => {
  it("flags a face match so callers can reject contact mismatches", () => {
    const face = faceA();
    const duplicate = findDuplicateFaceInOrganization({
      organizationId: "org-a",
      exceptEmployeeId: "emp-b",
      descriptor: face,
      threshold: DEFAULT_FACE_MATCH_THRESHOLD,
      candidates: [
        {
          employeeId: "emp-a",
          organizationId: "org-a",
          descriptor: face,
          email: "a@ex.com",
          phone: "0811111111",
        },
      ],
    });
    assert.ok(duplicate);
    assert.equal(
      contactsMatchByEmailOrPhone(
        { email: "b@ex.com", phone: "0822222222" },
        { email: "a@ex.com", phone: "0811111111" },
      ),
      false,
    );
  });

  it("allows same face across orgs (no in-org candidate)", () => {
    const face = faceA();
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
          email: "a@ex.com",
          phone: "0811111111",
        },
      ],
    });
    assert.equal(duplicate, null);
  });

  it("same face + matching phone is same identity", () => {
    assert.equal(
      contactsMatchByEmailOrPhone(
        { email: "b@ex.com", phone: "0812345678" },
        { email: "a@ex.com", phone: "+66812345678" },
      ),
      true,
    );
  });
});
