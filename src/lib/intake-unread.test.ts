import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { isUnreadIntake } from "./intake-unread";

describe("customer request unread rules", () => {
  it("only unreviewed customer submissions count, not unsent or cancelled requests", () => {
    assert.equal(isUnreadIntake({ status: "submitted", owner_seen_at: null }), true);
    assert.equal(isUnreadIntake({ status: "created", owner_seen_at: null }), false);
    assert.equal(isUnreadIntake({ status: "cancelled", owner_seen_at: null }), false);
  });
  it("a saved read time hides the badge; a new submission clearing it restores the badge", () => {
    assert.equal(isUnreadIntake({ status: "submitted", owner_seen_at: "2026-11-05T06:54:00Z" }), false);
    assert.equal(isUnreadIntake({ status: "submitted", owner_seen_at: null }), true);
  });
  it("completed and soft-deleted requests never count", () => {
    assert.equal(isUnreadIntake({ status: "submitted", owner_seen_at: null, estimate_completed_at: "2026-11-05T06:54:00Z" }), false);
    assert.equal(isUnreadIntake({ status: "submitted", owner_seen_at: null, deleted_at: "2026-11-05T06:54:00Z" }), false);
  });
});