import * as assert from "assert";
import * as vscode from "vscode";

import { openVirtualHttpFile } from "../services/editor.service";

suite("Editor Service", () => {
  test("opens virtual http document", async () => {
    const content = "GET https://example.com\\n";

    const doc = await openVirtualHttpFile(content, "request.http", {
      reveal: false,
    });
    assert.ok(doc, "Expected a document");
    assert.strictEqual(doc.uri.scheme, "untitled");
    assert.strictEqual(doc.getText(), content);
  });
});
