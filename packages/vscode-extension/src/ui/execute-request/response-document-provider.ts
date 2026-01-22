import * as vscode from "vscode";

export const RESPONSE_DOCUMENT_SCHEME = "watchapi-response";

export class ResponseDocumentProvider
    implements vscode.TextDocumentContentProvider
{
    private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
    private content = "";
    private durationMs?: number;

    readonly onDidChange = this.emitter.event;

    provideTextDocumentContent(): string {
        return this.content;
    }

    /**
     * Update document content and optional duration
     */
    update(content: string, durationMs?: number): void {
        this.content = content;
        this.durationMs = durationMs;
        this.emitter.fire(this.getUri());
    }

    /**
     * Generate URI with dynamic tab name
     */
    getUri(): vscode.Uri {
        const durationPart =
            this.durationMs !== undefined ? ` (${this.durationMs}ms)` : "";
        const fileName = `Response${durationPart}.http`;
        return vscode.Uri.parse(`${RESPONSE_DOCUMENT_SCHEME}:${fileName}`);
    }
}

let responseProvider: ResponseDocumentProvider | undefined;

export function getResponseDocumentProvider(): ResponseDocumentProvider {
    if (!responseProvider) {
        responseProvider = new ResponseDocumentProvider();
    }
    return responseProvider;
}
