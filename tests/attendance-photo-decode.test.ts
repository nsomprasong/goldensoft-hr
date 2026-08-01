import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decodePhotoBase64 } from "../src/lib/hr/attendance-photos";
import { sniffImageMime } from "../src/lib/hr/employee-photos";

describe("decodePhotoBase64", () => {
  it("decodes a data-URL JPEG", () => {
    const raw =
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z";
    const buf = decodePhotoBase64(raw);
    assert.ok(buf);
    assert.equal(sniffImageMime(buf!), "image/jpeg");
  });

  it("rejects empty input", () => {
    assert.equal(decodePhotoBase64(""), null);
    assert.equal(decodePhotoBase64(null), null);
  });
});
