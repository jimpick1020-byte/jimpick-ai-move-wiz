import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { unreadNotificationCount } from "./notification-count";

describe("owner notification unread count", () => {
  it("3 test notifications with 1 read leaves 2 unread", () => {
    assert.equal(unreadNotificationCount([
      { id: "a", readAt: "2026-10-28T00:00:00Z" }, { id: "b", readAt: null }, { id: "c", readAt: null },
    ]), 2);
  });
  it("the same notification is counted once", () => {
    assert.equal(unreadNotificationCount([{ id: "b", readAt: null }, { id: "b", readAt: null }]), 1);
  });
});
