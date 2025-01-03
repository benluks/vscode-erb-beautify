"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
const htmlbeautifier_1 = __importDefault(require("./htmlbeautifier"));
const micromatch_1 = __importDefault(require("micromatch"));
class HtmlBeautifierProvider {
    htmlbeautifier;
    constructor() {
        this.htmlbeautifier = new htmlbeautifier_1.default();
    }
    /**
     * Provides formatting edits for the entire document.
     * @param document - The document to be formatted.
     * @param options - The formatting options.
     * @param token - The cancellation token.
     * @returns The formatting edits.
     */
    provideDocumentFormattingEdits(document, options, token) {
        const start = new vscode.Position(0, 0); // Start at the beginning of the document.
        const end = document.lineAt(document.lineCount - 1).range.end; // End at the last line of the document.
        const range = new vscode.Range(start, end); // Range for the entire document.
        return this.formatDocument(document, range); // Format the entire document.
    }
    /**
     * Provides formatting edits for a specific range within the document.
     * @param document - The document to be formatted.
     * @param range - The range to be formatted.
     * @param options - The formatting options.
     * @param token - The cancellation token.
     * @returns The formatting edits.
     */
    provideDocumentRangeFormattingEdits(document, range, options, token) {
        return this.formatDocument(document, range);
    }
    /**
     * Formats the document or a specific range within the document.
     * @param document - The document to be formatted.
     * @param range - The range to be formatted.
     * @returns The formatting edits.
     */
    formatDocument(document, range) {
        if (this.shouldIgnore(document)) {
            this.htmlbeautifier.logChannel.info(`Ignoring ${document.fileName}`);
            return [];
        }
        return this.htmlbeautifier.format(document.getText(range)).then((result) => [new vscode.TextEdit(range, result)], (error) => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const shortFileName = document.fileName.split("/").pop();
            const fullMessage = `Error formatting ${shortFileName}: ${errorMessage}`;
            this.htmlbeautifier.logChannel.error(fullMessage);
            vscode.window.showErrorMessage(fullMessage);
            return [];
        });
    }
    /**
     * Checks if the document should be ignored based on user-defined patterns.
     * @param document - The document to be checked.
     * @returns Whether the document should be ignored.
     */
    shouldIgnore(document) {
        const config = vscode.workspace.getConfiguration("vscode-erb-beautify");
        const ignorePatterns = config.get("ignoreFormatFilePatterns", []);
        return micromatch_1.default.isMatch(document.fileName, ignorePatterns);
    }
}
exports.default = HtmlBeautifierProvider;
//# sourceMappingURL=htmlbeautifierProvider.js.map