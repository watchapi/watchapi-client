import * as assert from "assert";

import {
  ensureEndpointIdInHttpDocument,
  extractEndpointIdFromHttpDocument,
} from "../utils/watchapi-request-metadata";

suite("WatchAPI Request Metadata", () => {
  test("extracts endpoint id from http document", () => {
    const text = ["### WatchAPI Request", "# watchapi.endpointId: abc-123", ""].join("\n");
    assert.strictEqual(extractEndpointIdFromHttpDocument(text), "abc-123");
  });

  test("inserts endpoint id after WatchAPI title", () => {
    const original = ["### WatchAPI Request", "", "GET https://example.com", ""].join("\n");
    const next = ensureEndpointIdInHttpDocument(original, "endpoint-1");

    assert.ok(next.includes("# watchapi.endpointId: endpoint-1\n"));
    assert.strictEqual(extractEndpointIdFromHttpDocument(next), "endpoint-1");
  });

  test("does not double-insert endpoint id", () => {
    const original = [
      "### WatchAPI Request",
      "# watchapi.endpointId: endpoint-1",
      "",
      "GET https://example.com",
      "",
    ].join("\n");

    const next = ensureEndpointIdInHttpDocument(original, "endpoint-1");
    assert.strictEqual(next, original);
  });
});

