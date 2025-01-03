"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
const isWsl = require("is-wsl");
class HtmlBeautifier {
  logChannel;
  constructor() {
    this.logChannel = vscode.window.createOutputChannel("ERB Beautifier", {
      log: true,
    });
  }
  /**
   * Formats the input string using HTML Beautifier.
   * @param input The input string to be formatted.
   * @returns A promise that resolves to the formatted string.
   */
  async format(input) {
    const startTime = Date.now();
    const result = await this.executeCommand(input);
    const duration = Date.now() - startTime;
    this.logChannel.info(`Formatting completed successfully in ${duration}ms.`);
    return result;
  }
  /**
   * Executes the formatting command with the provided input.
   * @param input The input to format.
   * @returns A promise that resolves to the formatted output.
   */
  executeCommand(input) {
    return new Promise((resolve, reject) => {
      // Handle spawn EINVAL error on Windows. See https://github.com/nodejs/node/issues/52554
      const shellOptions = this.isWindows() ? { shell: true } : {};
      const htmlbeautifier = cp.spawn(this.exe, this.cliOptions, {
        cwd: vscode.workspace.rootPath || __dirname,
        env: {
          ...process.env,
          ...this.customEnvVars,
        },
        ...shellOptions,
      });
      const fullCommand = `${this.exe} ${this.cliOptions.join(" ")} with custom env: ${JSON.stringify(this.customEnvVars)}`;
      this.logChannel.info(`Formatting ERB with command: ${fullCommand}`);
      if (!htmlbeautifier.stdin || !htmlbeautifier.stdout) {
        reject("Failed to spawn process, missing stdin/stdout");
      }
      const stdoutChunks = [];
      const stderrChunks = [];
      htmlbeautifier.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
      htmlbeautifier.stderr.on("data", (chunk) => stderrChunks.push(chunk));
      htmlbeautifier.on("error", (error) => {
        reject(error);
      });
      htmlbeautifier.on("exit", (code) => {
        const errorMessage = Buffer.concat(stderrChunks).toString().trim();
        // Handle non-zero exit codes as errors
        if (code !== 0) {
          return reject(
            `Formatting failed with exit code ${code}: ${errorMessage}`,
          );
        }
        // Handle case where output is empty but input was not
        if (
          stdoutChunks.length > 0 &&
          stdoutChunks[0]
            .toString()
            .includes("Found no changes, using resolution from the lockfile")
        ) {
          this.logChannel.info(
            `First stdout chunk: ${stdoutChunks[0].toString()}`,
          );
          stdoutChunks.shift(); // Remove the first chunk
        }
        const formattedResult = Buffer.concat(stdoutChunks).toString();
        const finalResult = this.handleFinalNewline(input, formattedResult);
        if (input.trim() && finalResult.trim() === "") {
          return reject(
            `Formatting failed: the output is unexpectedly empty despite non-empty input. ${errorMessage}`,
          );
        }
        // If no errors, resolve with the formatted result
        resolve(finalResult);
      });
      htmlbeautifier.stdin.write(input);
      htmlbeautifier.stdin.end();
    });
  }
  /**
   * Gets the executable path for HTML Beautifier based on the configuration.
   * @returns The path to the executable.
   */
  get exe() {
    const config = vscode.workspace.getConfiguration("vscode-erb-beautify");
    const executePath = config.get("executePath", "htmlbeautifier");
    const useBundler = config.get("useBundler", false);
    const bundlerPath = config.get("bundlerPath", "bundle");
    const ext = this.isWindows() ? ".bat" : "";
    return useBundler ? `${bundlerPath}${ext}` : `${executePath}${ext}`;
  }
  /**
   * Checks if the current platform is Windows (excluding WSL).
   * @returns True if the platform is Windows; false otherwise.
   */
  isWindows() {
    return process.platform === "win32" && !isWsl;
  }
  /**
   * Retrieves the command-line options for HTML Beautifier from the configuration.
   * @returns An array of command-line options.
   */
  get cliOptions() {
    const config = vscode.workspace.getConfiguration("vscode-erb-beautify");
    const options = [];
    if (config.get("useBundler")) {
      options.push("exec", "htmlbeautifier");
    }
    return Object.keys(config).reduce((acc, key) => {
      switch (key) {
        case "indentBy":
          acc.push("--indent-by", config[key]);
          break;
        case "keepBlankLines":
          acc.push("--keep-blank-lines", config[key]);
          break;
        case "stopOnErrors":
          if (config["stopOnErrors"] === true) {
            acc.push("--stop-on-errors");
          }
          break;
        case "tab":
          if (config["tab"] === true) {
            acc.push("--tab");
          }
          break;
        case "tabStops":
          acc.push("--tab-stops", config[key]);
          break;
      }
      return acc;
    }, options);
  }
  /**
   * Retrieves custom environment variables from the configuration.
   * @returns A record of custom environment variables.
   */
  get customEnvVars() {
    const config = vscode.workspace.getConfiguration("vscode-erb-beautify");
    return config.get("customEnvVar", {});
  }
  /**
   * Adjusts the final newline of the result string based on VS Code configuration.
   * @param input The original input string.
   * @param result The formatted result string.
   * @returns The adjusted result string.
   */
  handleFinalNewline(input, result) {
    // Get the 'insertFinalNewline' setting from VS Code configuration
    const insertFinalNewline = vscode.workspace
      .getConfiguration()
      .get("files.insertFinalNewline");
    // Determine if the result ends with a newline
    const resultEndsWithNewline =
      result.endsWith("\n") || result.endsWith("\r\n");
    // If 'insertFinalNewline' is true and the result does not end with a newline
    if (insertFinalNewline && !resultEndsWithNewline) {
      // Get the 'files.eol' setting from VS Code configuration
      const eol = vscode.workspace.getConfiguration().get("files.eol");
      // Determine newline character(s) based on the 'files.eol' setting and the platform
      const newline = eol === "auto" ? (this.isWindows() ? "\r\n" : "\n") : eol;
      // Append the newline to the result
      result += newline;
    } else if (!insertFinalNewline) {
      // If 'insertFinalNewline' is false, adjust the result's ending to match the input's ending
      // Get the newline character(s) used in the input and result
      const inputNewline = this.getNewline(input);
      const resultNewline = this.getNewline(result);
      // If the input and result use different newline character(s)
      if (inputNewline !== resultNewline) {
        // Remove the newline from the end of the result and append the input's newline
        result = result.slice(0, -resultNewline.length) + inputNewline;
      }
    }
    // Return the processed result
    return result;
  }
  /**
   * Determines the newline character(s) used in the input string.
   * @param input The input string.
   * @returns The newline character(s) used, or an empty string if none.
   */
  getNewline(input) {
    if (input.endsWith("\r\n")) {
      return "\r\n"; // Return Windows-style newline
    } else if (input.endsWith("\n")) {
      return "\n"; // Return Unix-style newline
    }
    return ""; // Return empty if no newline found
  }
}
exports.default = HtmlBeautifier;
//# sourceMappingURL=htmlbeautifier.js.map
