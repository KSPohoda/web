#!/usr/bin/env node

// @ts-check

import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import perf_hooks from "node:perf_hooks";
import url from "node:url";
/** @typedef {import("node:http").ServerResponse} ServerResponse */
/** @typedef {import("node:http").IncomingMessage} IncomingMessage */

//
// <Globals>
//

const SCRIPT_NAME = "serve";

const __dirname = import.meta.dirname;

/** @type {Params} */
let opts;
/** @type {Logger} */
let log;

/** @type {Map<string, ServerResponse>} */
let sse_connections;

//
// </Globals>
// <ANSI>
//

/** @typedef {[red: number, green: number, blue: number]} RGB */

const ansi = {
    Reset: "\x1b[0m",
    Bold: "\x1b[1m",
    BoldReset: "\x1b[22m",
    Dim: "\x1b[2m",
    DimReset: "\x1b[22m",
    Underscore: "\x1b[4m",
    UnderscoreReset: "\x1b[24m",
    Blink: "\x1b[5m",
    Reverse: "\x1b[7m",
    Hidden: "\x1b[8m",

    FgBlack: "\x1b[30m",
    FgRed: "\x1b[31m",
    FgGreen: "\x1b[32m",
    FgYellow: "\x1b[33m",
    FgBlue: "\x1b[34m",
    FgMagenta: "\x1b[35m",
    FgCyan: "\x1b[36m",
    FgWhite: "\x1b[37m",
    FgGray: "\x1b[90m",
    /** @param {RGB} rgb */
    FgRGB: ([r, g, b]) => `\x1b[38;2;${r};${g};${b}m`,

    BgBlack: "\x1b[40m",
    BgRed: "\x1b[41m",
    BgGreen: "\x1b[42m",
    BgYellow: "\x1b[43m",
    BgBlue: "\x1b[44m",
    BgMagenta: "\x1b[45m",
    BgCyan: "\x1b[46m",
    BgWhite: "\x1b[47m",
    BgGray: "\x1b[100m",
    /** @param {RGB} rgb */
    BgRGB: ([r, g, b]) => `\x1b[48;2;${r};${g};${b}m`,
};

/**
 * @returns A random 24-bit foreground code
 */
function randFg() {
    return ansi.FgRGB(hsl2rgb(rng(0, 360), rng(0.5, 1), rng(0.5, 0.7)));
}

/**
 * @param {number} min
 * @param {number} max
 * @returns [min, max]
 */
function rng(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * @see https://stackoverflow.com/a/64090995
 * @param {number} hue [0,360]
 * @param {number} saturation [0, 1]
 * @param {number} lightness [0, 1]
 * @returns {RGB} [0, 255]
 */
function hsl2rgb(hue, saturation, lightness) {
    let a = saturation * Math.min(lightness, 1 - lightness);
    /** @param {number} n */
    function f(n) {
        const k = (n + hue / 30) % 12;
        return Math.round(
            (lightness - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)) * 255,
        );
    }
    return [f(0), f(8), f(4)];
}

//
// </ANSI>
// <Logger>
//

/**
 * @typedef {(...msgs: unknown[]) => void} Log
 */

/**
 * @typedef {object} LogOpts
 * @property {string | null} [name]
 * @property {number | null} [level]
 */

let log_enum_counter = 0;
const LogLevelEnum = {
    Panic: log_enum_counter++,
    Err: log_enum_counter++,
    Warn: log_enum_counter++,
    Info: log_enum_counter++,
    Debug: log_enum_counter++,
};

/**
 * @param {unknown} msg
 * @returns {string}
 */
function stringifyMsg(msg) {
    let res = "";
    if (msg instanceof Error) {
        res = msg.stack ?? msg.message;
    } else if (typeof msg === "object") {
        res = JSON.stringify(msg, null, "  ");
    } else {
        res = String(msg);
    }
    return res;
}

/**
 * @param {unknown} msgs
 * @returns {string}
 */
function stringifyMsgs(msgs) {
    let str = [];
    if (Array.isArray(msgs)) {
        for (const msg of msgs) {
            str.push(stringifyMsg(msg));
        }
    } else {
        str.push(stringifyMsg(msgs));
    }
    return str.join(" ");
}

/**
 * @param {...(ansi[keyof ansi])} props
 * @param {unknown} msgs
 * @returns {string}
 */
function fmt(msgs, ...props) {
    let msg = props.join("");
    msg += stringifyMsgs(msgs);
    msg += ansi.Reset;
    return msg;
}

/**
 * @param {LogOpts} [opts]
 */
function initLog(opts = {}) {
    const level = opts.level ?? Infinity;
    return {
        /** @type {Log} */
        debug(...msgs) {
            if (level < LogLevelEnum.Debug) return;
            const msg = fmt(msgs, ansi.FgGray);
            console.debug(msg);
        },
        /** @type {Log} */
        info(...msgs) {
            if (level < LogLevelEnum.Info) return;
            const msg = fmt(msgs);
            console.info(msg);
        },
        /** @type {Log} */
        warn(...msgs) {
            if (level < LogLevelEnum.Warn) return;
            const msg = fmt(msgs, ansi.FgYellow);
            console.warn(msg);
        },
        /** @type {Log} */
        err(...msgs) {
            if (level < LogLevelEnum.Err) return;
            const msg = fmt(msgs, ansi.FgRed);
            console.error(msg);
        },
    };
}

/** @typedef {ReturnType<initLog>} Logger */

//
// </Logger>
// <CLIHelpBuilder>
//

/**
 * @typedef  {object}           HelpSections
 * @property {string}           [description] A description of what the script does
 * @property {HelpPositional[]} [positional]  Positional arguments; e.g.: `$ cc main.c`
 * @property {HelpFlag[]}       [flags]       Standalone parameters that don't receive a value; e.g.: `-verbose`; `-help` is implicit
 * @property {HelpArgument[]}   [arguments]   Parameters that receive a value; e.g.: `-output path/to/output`
 * @property {HelpTask[]}       [tasks]       Parameters that can be added or subtracted; e.g.: `+taskA -taskB +taskC`
 * @property {HelpExample[]}    [examples]    Practical examples for how to use the script
 *
 * @typedef  {object} HelpFlag
 * @property {string} name
 * @property {string} description
 *
 * @typedef  {object} HelpArgument
 * @property {string} name
 * @property {string} type
 * @property {string} description
 * @property {string} arg_default
 *
 * @typedef  {object} HelpPositional
 * @property {string} name
 * @property {number} position
 * @property {string} type
 * @property {string} description
 * @property {string} arg_default
 *
 * @typedef  {object} HelpTask
 * @property {string} name
 * @property {string} description
 *
 * @typedef  {object} HelpExample
 * @property {string} description
 * @property {string} [options]
 */

/** Padding left */
const PL = "  ";
/** Padding left for options */
const PLO = " ";

/**
 * @param {string} arg0
 * @param {HelpSections} sections
 * @returns {string}
 */
function buildHelpMessage(arg0, sections) {
    let res;
    /** @type {string[]} */
    let printedSections = [];
    printedSections.push(buildUsage(arg0, sections));
    res = sections.description?.trim();
    if (res) printedSections.push(res);
    res = buildPositional(sections.positional);
    if (res) printedSections.push(res);
    res = buildTasks(sections.tasks);
    if (res) printedSections.push(res);
    res = buildArgs(sections.arguments);
    if (res) printedSections.push(res);
    res = buildFlags(sections.flags);
    if (res) printedSections.push(res);
    res = buildExamples(sections.examples, arg0);
    if (res) printedSections.push(res);
    return printedSections.join("\n\n") + "\n";
}

/**
 * @param {string} arg0
 * @param {HelpSections} sections
 * @returns {string}
 */
function buildUsage(arg0, sections) {
    let res = "";
    res += ansi.Bold + "Usage: " + ansi.Reset;
    res += arg0;
    if (sections.positional?.length) {
        for (const pos of sections.positional) {
            res += " [" + ansi.FgCyan + pos.name + ansi.Reset + "]";
        }
    }
    if (sections.flags?.length) {
        res += " [" + ansi.FgGreen + "Flags..." + ansi.Reset + "]";
    }
    if (sections.arguments?.length) {
        res += " [" + ansi.FgMagenta + "Arguments..." + ansi.Reset + "]";
    }
    if (sections.tasks?.length) {
        res += " [" + ansi.FgYellow + "Tasks..." + ansi.Reset + "]";
    }
    return res;
}

/**
 * @param {HelpTask[]} [defs]
 * @returns {string}
 */
function buildTasks(defs) {
    let section = "";
    if (defs?.length) {
        section += header("Tasks", ansi.FgYellow);
        const longestName = Math.max(...defs.map(({ name }) => name.length));
        section += defs
            .map(({ name, description }) => {
                let item = "";
                item += ansi.FgYellow;
                item += PL;
                item += name.padEnd(longestName);
                item += ansi.Reset;
                item += PL;
                item += description;
                return item;
            })
            .join("\n");
    }
    return section;
}

/**
 * @param {HelpPositional[]} [defs]
 * @returns {string}
 */
function buildPositional(defs) {
    let section = "";
    if (defs?.length) {
        section += header("Positional", ansi.FgCyan);
        const longestNameArg = Math.max(
            ...defs.map(({ name, type }) => name.length + type.length + 3),
        );
        section += defs
            .map(({ name, type, description, arg_default }) => {
                let item = "";
                item += ansi.FgCyan;
                item += PLO + "-";
                const nameArg = `${name} <${type}>`;
                item += nameArg.padEnd(longestNameArg);
                item += ansi.Reset;
                item += PL;
                item += description;
                item += fmt(` (default: ${arg_default})`, ansi.Dim);
                return item;
            })
            .join("\n");
    }
    return section;
}

/**
 * @param {HelpArgument[]} [defs]
 * @returns {string}
 */
function buildArgs(defs) {
    let section = "";
    if (defs?.length) {
        section += header("Arguments", ansi.FgMagenta);
        const longestNameArg = Math.max(
            ...defs.map(({ name, type }) => name.length + type.length + 3),
        );
        section += defs
            .map(({ name, type, description, arg_default }) => {
                let item = "";
                item += ansi.FgMagenta;
                item += PLO + "-";
                const nameArg = `${name} <${type}>`;
                item += nameArg.padEnd(longestNameArg);
                item += ansi.Reset;
                item += PL;
                item += description;
                item += fmt(` (default: ${arg_default})`, ansi.Dim);
                return item;
            })
            .join("\n");
    }
    return section;
}

/**
 * @param {HelpFlag[]} [defs]
 * @returns {void}
 */
function ensureHelp(defs) {
    defs ||= [];
    const hasHelp = defs.some((def) => def.name === "help");
    if (!hasHelp) {
        defs.push({ name: "help", description: "Prints this message" });
    }
}

/**
 * @param {HelpFlag[]} [defs]
 * @returns {string}
 */
function buildFlags(defs) {
    ensureHelp(defs);
    let section = "";
    if (defs?.length) {
        section += header("Flags", ansi.FgGreen);
        const longestName = Math.max(...defs.map(({ name }) => name.length));
        section += defs
            .map(({ name, description }) => {
                let item = "";
                item += ansi.FgGreen;
                item += PLO + "-";
                item += name.padEnd(longestName);
                item += ansi.Reset;
                item += PL;
                item += description;
                return item;
            })
            .join("\n");
    }
    return section;
}

/**
 * @param {string} arg0
 * @param {HelpExample[] | undefined} defs
 * @returns {string}
 */
function buildExamples(defs, arg0) {
    let section = "";
    if (defs?.length) {
        section += header("Examples", ansi.FgBlue);
        section += defs
            .map(({ description, options }) => {
                let item = "";
                item += PL;
                item += description;
                item += "\n";
                item += PL;
                item += ansi.Dim;
                if (options) {
                    item += `$ ${arg0} ${options}`;
                } else {
                    item += `$ ${arg0}`;
                }
                item += ansi.Reset;
                return item;
            })
            .join("\n\n");
    }
    return section;
}

/**
 * @param {string} str
 * @param {string} [colour]
 * @returns {string}
 */
function header(str, colour) {
    const res = ansi.Bold + str + ":" + ansi.BoldReset + "\n";
    if (colour) {
        return colour + res + ansi.Reset;
    } else {
        return res;
    }
}

//
// </CLIHelpBuilder>
// <CLIParams>
//

/** @satisfies {ParamsDefinition} */
const params_definition = /** @type {const} */ ({
    port: {
        aliases: ["port", "p"],
        type: "number",
        default_value: 8080,
        validate: (v) => Number.isInteger(v),
        description: "Port number to listen at",
    },
    verbose: {
        aliases: ["verbose", "v"],
        type: "boolean",
        default_value: undefined,
        description: "Print debug messages",
    },
    watch: {
        aliases: ["watch", "w"],
        type: "boolean",
        default_value: undefined,
        description: "Reload page on source file change",
    },
    dirpath: {
        position: 0,
        type: "string",
        default_value: ".",
        description: "Path to the directory to serve",
    },
});

const cli_description = "A static server with development functionality";
/** @type {HelpExample[]} */
const cli_examples = [
    { description: "Serve the directory the script is called from" },
    {
        description: "Serve www/ on port 3000 and reload on change",
        options: "-p 3000 www -watch",
    },
];

//
// </CLIParams>
// <CLIParamHelpers>
//

/** @typedef {"string" | "number" | "boolean"} ParamType */

/** @typedef {(value: unknown) => boolean} Validator */

/**
 * @typedef  {object}    ParamDefinition
 * @property {number}    [position]
 * @property {string[]}  [aliases]
 * @property {ParamType} type
 * @property {unknown}   default_value
 * @property {Validator} [validate]
 * @property {string}    description
 */

/**
 * @typedef {Record<string, ParamDefinition>} ParamsDefinition
 */

/**
 * @typedef  {object}  TypeMap
 * @property {string}  string
 * @property {number}  number
 * @property {boolean} boolean
 */

/**
 * @typedef {
    {[k in keyof typeof params_definition]:
        TypeMap[typeof params_definition[k]["type"]] |
        typeof params_definition[k]["default_value"]
    }} Params
 */

/** @typedef {string | number | symbol} RecordKey */

/**
 * @template {Record<RecordKey, unknown>} Obj
 * @template {keyof Obj}                  Key
 * @template {Key[]}                      Ret
 * @param    {Obj} obj
 * @returns  {Ret}
 */
function TypedKeys(obj) {
    return /** @type {Ret} */ (Object.keys(obj));
}

/**
 * @template {ParamDefinition}    D
 * @template {TypeMap[D["type"]]} V
 * @param    {D}      def
 * @param    {string} arg
 * @returns  {V | null}
 */
function parseArgValue(def, arg) {
    let res = null;
    switch (def.type) {
        case "string": {
            res = arg;
            break;
        }
        case "number": {
            res = Number(arg);
            break;
        }
        case "boolean": {
            res = /tr?u?e?|ye?s?|1/i.test(arg);
        }
    }
    return /** @type {V | null} */ (res);
}

/**
 * @param   {string[]} argv
 * @returns {Params}
 */
function parseArgs(argv) {
    const def_keys = TypedKeys(params_definition);
    const res = /** @type {Params} */ (
        Object.fromEntries(
            def_keys.map((k) => {
                return [k, params_definition[k].default_value];
            }),
        )
    );
    let current_position = 0;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i].toLowerCase();
        if (/--?he?l?p?/.test(arg)) {
            printHelp();
        }
        let value = null;
        for (const def_key of def_keys) {
            const def = params_definition[def_key];
            if (arg.startsWith("-")) {
                if ("aliases" in def) {
                    const aliases = /** @type {string[]} */ (def.aliases);
                    if (aliases.includes(arg.slice(1))) {
                        if (def.type === "boolean") {
                            value = true;
                        } else {
                            value = parseArgValue(def, argv[++i]);
                        }
                    }
                } else {
                    // not applicable
                }
            } else {
                if ("position" in def && def.position === current_position) {
                    value = parseArgValue(def, arg);
                    current_position += 1;
                } else {
                    // not applicable
                }
            }
            if (value) {
                if ("validate" in def && !def.validate(value)) {
                    printHelp(
                        `Invalid value for argument '${def_key}': '${argv[i]}'`,
                    );
                } else {
                    // @ts-expect-error Assigning to a readonly property
                    res[def_key] = value;
                    break;
                }
            }
        }
        if (!value) {
            printHelp(`Unknown argument: '${argv[i]}'`);
        }
    }
    return res;
}

/**
 * @param {string} [err]
 * @returns {never}
 */
function printHelp(err) {
    if (err) {
        process.stderr.write(
            `${fmt("Error:", ansi.FgRed, ansi.Bold)} ${fmt(err, ansi.FgRed)}\n\n`,
        );
    }

    /** @type {HelpPositional[]} */
    const positional = [];
    /** @type {HelpArgument[]} */
    const args = [];
    /** @type {HelpFlag[]} */
    const flags = [];

    for (const def_key of TypedKeys(params_definition)) {
        const def = params_definition[def_key];
        if ("position" in def) {
            positional.push({
                name: def_key.toUpperCase(),
                description: def.description,
                arg_default: def.default_value,
                position: def.position,
                type: def.type,
            });
        } else if ("aliases" in def) {
            const name = def.aliases[0];
            if (def.type === "boolean") {
                flags.push({ name, description: def.description });
            } else {
                args.push({
                    name,
                    description: def.description,
                    arg_default: String(def.default_value),
                    type: def.type,
                });
            }
        }
    }

    const helpMsg = buildHelpMessage(SCRIPT_NAME, {
        description: cli_description,
        positional,
        arguments: args,
        flags,
        examples: cli_examples,
    });
    process.stderr.write(helpMsg);
    process.exit(err ? 1 : 0);
}

//
// </CLIParamHelpers>
// <Types>
//

/**
 * @callback RequestHandler
 * @param    {IncomingMessage} req
 * @param    {ServerResponse}  res
 * @param    {string}          [pathname]
 * @returns  {Promise<void>}
 */

//
// </Types>
// <Middleware>
//

/**
 * @param   {number} ms
 * @returns {string}
 */
function fmtTime(ms) {
    if (ms < 1000) {
        return `${ms.toFixed(2)} ms`;
    } else if (ms < 1000 * 60) {
        return `${(ms / 1000).toFixed(2)} s`;
    } else if (ms < 1000 * 60 * 60) {
        return `${(ms / 1000 / 60).toFixed(2)} m`;
    } else {
        return `${(ms / 1000 / 3600).toFixed(2)} h`;
    }
}

/**
 * @param {RequestHandler} next
 * @returns {RequestHandler}
 */
function logRequestMiddleware(next) {
    return async (req, res) => {
        const ts = perf_hooks.performance.now();
        await next(req, res);
        const duration = perf_hooks.performance.now() - ts;
        log.info(`${req.method}: ${req.url}`);
        let msg = "";
        if (res.statusCode < 400) {
            msg += ansi.FgGreen + res.statusCode + ansi.Reset;
            let contentType = res.getHeader("Content-Type");
            if (contentType) {
                if (Array.isArray(contentType)) {
                    contentType = contentType.join(", ");
                }
                msg += " " + ansi.FgGray + contentType + ansi.Reset;
            }
        } else if (res.statusCode < 500) {
            msg += ansi.FgYellow + res.statusCode + ansi.Reset;
        } else {
            msg += ansi.FgRed + res.statusCode + ansi.Reset;
            msg += " " + res.statusMessage;
        }
        msg += " " + ansi.Dim + fmtTime(duration) + ansi.DimReset;
        log.info(msg);
    };
}

//
// </Middleware>
// <RouteHandlers>
//

/**
 * @param {ServerResponse} res
 * @param {string} msg
 * @returns {void}
 */
function notFound(res, msg) {
    res.statusCode = 404;
    res.end(msg);
}

/** @type {RequestHandler} */
async function SSERegister(req, res) {
    const remoteAddress = req.socket.remoteAddress ?? "unknown";
    sse_connections.set(remoteAddress, res);
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
    });
    log.debug(`SSE: ${remoteAddress} registered`);
    req.on("close", () => {
        log.debug(`SSE: ${remoteAddress} closed`);
        sse_connections.delete(remoteAddress);
        res.end("closed");
    });
}

function SSESendReload() {
    const msg = "data: reload\n\n";
    sse_connections.forEach((res, client) => {
        res.write(msg);
        log.debug(`SSE: ${client} reloaded`);
    });
}

/**
 * @typedef  {object} APIOpts
 * @property {string} pathname
 */

const APIPathRegex = /^\/api\/(\d+)(.*)$/;

/**
 * @param {APIOpts} opts
 * @returns {RequestHandler}
 */
function handleAPI(opts) {
    return async (_req, res) => {
        const [, version, pathname] = APIPathRegex.exec(opts.pathname) ?? [];
        if (version == null || !pathname?.startsWith("/")) {
            return notFound(res, "Invalid API endpoint");
        }
    };
}

/**
 * Limits the path to a directory to prevent the directory traversal attack
 * @see https://en.wikipedia.org/wiki/Directory_traversal_attack
 * @param {string} pathname
 * @returns string
 */
function sanitisePath(pathname) {
    return path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
}

/**
 * @param {string} pathname
 * @param {string} [prefix]
 */
function getFilepath(pathname, prefix) {
    let filepath = pathname;
    if (prefix) {
        if (filepath.startsWith(prefix)) {
            filepath = filepath.slice(prefix.length);
        } else {
            return null;
        }
    }
    filepath = sanitisePath(filepath);
    return filepath;
}

const mimeType = {
    ".ico": "image/x-icon",
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".css": "text/css",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".doc": "application/msword",
    ".eot": "application/vnd.ms-fontobject",
    ".ttf": "application/x-font-ttf",
};

/**
 * @param {ServerResponse} res
 * @param {string} pathname
 * @param {FileTransforms} [transforms]
 * @returns {Promise<void>}
 */
async function file(res, pathname, transforms) {
    try {
        const { ext } = path.parse(pathname);
        let data = await fs.readFile(pathname);
        const transform = transforms?.[ext];
        if (transform) {
            data = transform(data);
        }
        res.statusCode = 200;
        const contentType = mimeType[ext] ?? "text/plain";
        res.setHeader("Content-Type", contentType);
        res.end(data);
    } catch (err) {
        notFound(res, `'${pathname}' not found`);
    }
}

/**
 * @typedef {Record<string, (buf: Buffer) => Buffer>} FileTransforms
 */

/**
 * @typedef  {object}         StaticOpts
 * @property {string}         pathname
 * @property {string}         [prefix]
 * @property {string}         [directory]
 * @property {boolean}        [runtimeRouting]
 * @property {FileTransforms} [transforms]
 */

/**
 * @param {StaticOpts} opts
 * @returns {RequestHandler}
 */
function handleStatic(opts) {
    return async (_req, res) => {
        let filepath = getFilepath(opts.pathname, opts.prefix);
        if (!filepath) return;
        const dirpath = opts.directory ?? "";
        filepath = path.join(dirpath, filepath);
        try {
            if ((await fs.stat(filepath)).isDirectory()) {
                filepath = path.join(filepath, "index.html");
            }
            return file(res, filepath, opts.transforms);
        } catch (err) {
            if (opts.runtimeRouting) {
                return file(res, path.join(dirpath, "index.html"));
            } else {
                return notFound(res, `'${filepath}' not found`);
            }
        }
    };
}

/**
 * @param {Buffer} buf
 * @returns {Buffer}
 */
function injectDevHTML(buf) {
    let content = buf.toString("utf8");
    content = content.replace(
        "</head>",
        `<script type="text/javascript">new EventSource('/reload').onmessage=()=>window.location.reload(true)</script></head>`,
    );
    return Buffer.from(content, "utf8");
}

/** @type {RequestHandler} */
async function route(req, res) {
    if (req.url == null) {
        return notFound(res, "No URL");
    }
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname === "/reload") {
        return SSERegister(req, res);
    } else if (pathname.startsWith("/api")) {
        return handleAPI({ pathname })(req, res);
    } else if (pathname.startsWith("/")) {
        return handleStatic({
            pathname,
            directory: opts.dirpath,
            transforms: opts.watch ? { [".html"]: injectDevHTML } : undefined,
        })(req, res);
    } else {
        return notFound(res, "Unmatched pathname");
    }
}

//
// </RouteHandlers>
// <Throttle>
//

/**
 * Drops subsequent calls for a time
 * @param {number}     ms Time in milliseconds
 * @param {() => void} cb
 */
function throttle(ms, cb) {
    let is_timed_out = false;
    let is_timeout_active = false;
    return () => {
        if (!is_timed_out) {
            is_timed_out = true;
            cb();
            if (!is_timeout_active) {
                is_timeout_active = true;
                setTimeout(
                    () => ((is_timed_out = false), (is_timeout_active = false)),
                    ms,
                );
            }
        }
    };
}

//
// </Throttle>
// <Main>
//

/**
 * @param {string}     dir
 * @param {() => void} cb
 */
async function watch(dir, cb) {
    try {
        const throttledCB = throttle(100, cb);
        const watcher = fs.watch(dir, { recursive: true });
        for await (const _event of watcher) {
            throttledCB();
        }
    } catch (err) {
        log.err(err);
    }
}

/**
 * @arg {Params} args
 */
function run(args) {
    opts = args;
    log = initLog({
        level: opts.verbose ? LogLevelEnum.Debug : LogLevelEnum.Warn,
    });
    log.debug(opts);
    log.debug(__dirname);
    sse_connections = new Map();
    if (opts.watch) watch(opts.dirpath, SSESendReload);
    http.createServer(logRequestMiddleware(route)).listen(opts.port);
    log.info(`Listening on http://localhost:${opts.port}`);
}

/**
 * Wrapper allowing this file to be used both as a CLI and a library
 */
(function main() {
    const entryFile = process.argv[1];
    if (entryFile === url.fileURLToPath(import.meta.url)) {
        run(parseArgs(process.argv.slice(2)));
    }
})();

export default run;

//
// </Main>
//
