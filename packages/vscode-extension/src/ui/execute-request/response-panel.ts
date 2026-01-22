import * as vscode from "vscode";
import { ApiEndpoint } from "@/shared";
import { HttpResponse } from "@/shared/http-response";
import { getResponseDocumentProvider } from "./response-document-provider";
import { formatHeaders } from "@/shared/misc";

let currentEditor: vscode.TextEditor | undefined;

export async function showResponsePanel(
    endpoint: ApiEndpoint,
    response: HttpResponse,
): Promise<void> {
    const content = formatResponseDocument(endpoint, response);
    const responseProvider = getResponseDocumentProvider();
    const responseUri = responseProvider.getUri();
    let document = currentEditor?.document;

    const timing = response.timingPhases.total ?? 0;
    responseProvider.update(content, timing);

    if (
        !document ||
        document.isClosed ||
        document.uri.toString() !== responseUri.toString()
    ) {
        document = await vscode.workspace.openTextDocument(responseUri);
    }

    await vscode.languages.setTextDocumentLanguage(document, "http");

    currentEditor = await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.Two,
        preserveFocus: true,
        preview: false,
    });
}

function formatResponseDocument(
    _: ApiEndpoint,
    response: HttpResponse,
): string {
    const statusLine = `HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage}`;

    const headerLines = formatHeaders(response.headers).trim();

    const body = formatResponseBody(response);

    const headerSection = headerLines ? `${headerLines}\n\n` : "\n\n";

    return [statusLine, headerSection + (body ?? ""), ""].join("\n");
}

function formatResponseBody(response: HttpResponse): string {
    if (!response.body) return "";

    const contentType = response.contentType ?? "";
    if (contentType.includes("application/json")) {
        try {
            return JSON.stringify(JSON.parse(response.body), null, 2);
        } catch {
            return response.body;
        }
    }

    return response.body;
}
