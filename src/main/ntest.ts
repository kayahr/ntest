#!/usr/bin/env node
/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import cp from "node:child_process";
import { parseArgs } from "node:util";
import packageJSON from "../../package.json" with { type: "json" };
import { readFile } from "node:fs/promises";
import { fileExists, findPackageRoot, getErrorMessage } from "./utils.ts";
import { join } from "node:path";

/** The default config file locations to look for. */
const defaultConfigLocations = [
    "ntest.json",
    ".ntest.json"
];

/**
 * CLI IO interface with stdout and stderr.
 */
export interface IO {
    stdout: NodeJS.WritableStream;
    stderr: NodeJS.WritableStream;
};

/**
 * Options for {@link runNodeTest}.
 */
interface NTestOptions {
    /** List of test files to run or glob patterns to match test files. */
    files?: string | string[];

    /**
     * Reporters and output destinations to use. Standard "spec" reporter outputting to "stdout"
     * is used if not specified. When destination is not set or empty then "stdout" is assumed
     * as destination.
     */
    reporter?: Array<{ name: string, destination?: string }>;

    /** Specify test runner concurrency. */
    concurrency?: number;

    /**
     * Configures the type of test isolation. If set to 'process', each test file is run in a
     * separate child process. If set to 'none', all test files run in the current process.
     * Default: 'process'.
     */
    isolation?: "process" | "none";

    /** Enable module mocking in the test runner. */
    moduleMocks?: boolean;

    /** Force test runner to exit upon completion. */
    forceExit?: boolean;

    /** Path to the global setup file. */
    globalSetup?: string;

    /** Run tests with 'only' option set. */
    only?: boolean;

    /** Run test at specific shard. */
    shard?: string;

    /** Run tests whose name matches this regular expression. */
    testPattern?: string | string[];

    /** Run tests whose name do not match this regular expression. */
    skipPattern?: string | string[];

    /** Specify test runner timeout in milliseconds. */
    timeout?: number;

    /** Regenerate test snapshots. */
    updateSnapshots?: boolean;

    /** Path to the rerun state file. */
    rerunFailures?: string;

    /** Run in watch mode. */
    watch?: boolean;

    /** Optional coverage thresholds (only used when coverage is enabled) */
    coverage?: {
        /** Enable code coverage in the test runner. */
        enabled?: boolean;

        /** Include files in coverage report that match this glob pattern. */
        include?: string | string[];

        /** Exclude files from coverage report that match this glob pattern. */
        exclude?: string | string[];

        /** The line coverage minimum threshold. */
        lines?: number;

        /** The branch coverage minimum threshold.. */
        branches?: number;

        /** The function coverage minimum threshold. */
        functions?: number;
    }
}

/** The help text. */
const commandName = "ntest";
const help = `Usage: ${commandName} [OPTION]... [FILES]...

${packageJSON.description}

Options:
  --config, -c <file>          optional specific configuration file to read. Looks for 'ntest.json', '.ntest.json' or
                               'ntest' property in 'package.json' by default
  --concurrency <n>            specify test runner concurrency
  --coverage                   enable test coverage report
  --coverage-branches <n>      branch coverage threshold in percent
  --coverage-functions <n>     function coverage threshold in percent
  --coverage-lines <n>         line coverage threshold in percent
  --coverage-exclude <glob>    exclude files in coverage report matching this glob pattern. Can be used multiple times
  --coverage-include <glob>    include files in coverage report matching this glob pattern. Can be used multiple times
  --force-exit                 force test runner to exit upon completion
  --global-setup <file>        specifies the path to the global setup file
  --isolation <s>              configures the type of test isolation used in the test runner ('none' or 'process')
  --module-mocks               enable module mocking in the test runner
  --only                       run tests with 'only' option set.
  --reporter <name>[:<file>]   use specified reporter instead of standard reporter. Can be used multiple times
                               Optional output file (or stdout/stderr) can be specified. Default output is stdout
  --rerun-failures             specifies the path to the rerun state file
  --shard <index/total>        run test at specified shard
  --skip-pattern, -s <regex>   skip tests whose name matches this regular expression. Can be used multiple times
  --test-pattern, -t <regex>   run tests whose name matches this regular expression. Can be used multiple times
  --timeout <n>                specify test runner timeout in milliseconds
  --update-snapshots, -u       regenerate test snapshots
  --watch, -w                  run in watch mode
  --help                       display this help and exit
  --version                    output version information and exit

Additional Node options can be specified after '--'. Example:

  ntest --coverage -- --no-warnings

Report bugs to <${packageJSON.bugs}>.
`;

/** The version text. */
const version = `${commandName} ${packageJSON.version}

Written by ${packageJSON.author.name} <${packageJSON.author.email}>
`;

/**
 * Spawns Node with given parameters.
 *
 * @param io     - The stdout/stderr streams
 * @param params - The parameters to pass to Node process.
 */
function spawnNode(io: IO, params: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = cp.spawn("node", params, {
            stdio: [ "inherit", io.stdout === process.stdout ? "inherit" : "pipe", io.stderr === process.stderr ? "inherit" : "pipe" ]
        });
        child.stdout?.pipe(io.stdout, { end: false });
        child.stderr?.pipe(io.stderr, { end: false });
        child.on("error", reject);
        child.on("close", exitCode => {
            if (exitCode === 0) {
                resolve();
            } else {
                reject(new Error(`Node exited with code ${exitCode}`));
            }
        });
    });
}

/**
 * Read the ntest configuration. Either from specified file, one of the default files, or the package.json
 *
 * @param configFile - Optional explicit configuration file. If not specified then config is searched.
 * @returns The ntest options. Empty object if none found.
 */
async function readConfig(configFile?: string): Promise<NTestOptions> {
    if (configFile != null) {
        try {
            return JSON.parse(await readFile(configFile, "utf8")) as NTestOptions;
        } catch (error) {
            throw new Error(`Error while reading config '${configFile}': ${getErrorMessage(error)}`, { cause: error });
        }
    }
    const root = await findPackageRoot();
    for (const configFile of defaultConfigLocations) {
        const path = join(root, configFile);
        if (await fileExists(path)) {
            return readConfig(path);
        }
    }
    const packageJSON = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { ntest?: NTestOptions };
    return packageJSON.ntest ?? {};
}

/**
 * Runs Node Test with the given options.
 *
 * @param io      - The stdout/stderr streams
 * @param options - The ntest options to be translated to Node Test command line options.
 */
async function runNodeTest(io: IO, options: NTestOptions): Promise<void> {
    // Fetch the major node version number to deal with CLI parameter differences
    const nodeVersion = parseInt(process.versions.node);

    const params = [
        "--test"
    ];

    // Handle coverage options
    const coverage = options.coverage;
    if (coverage?.enabled === true) {
        params.push("--experimental-test-coverage");
        for (const exclude of [ coverage?.exclude ?? []].flat()) {
            params.push(`--test-coverage-exclude=${exclude}`);
        }
        for (const include of [ coverage?.include ?? []].flat()) {
            params.push(`--test-coverage-include=${include}`);
        }
        if (coverage?.branches != null) {
            params.push(`--test-coverage-branches=${coverage.branches}`);
        }
        if (coverage?.functions != null) {
            params.push(`--test-coverage-functions=${coverage.functions}`);
        }
        if (coverage?.lines != null) {
            params.push(`--test-coverage-lines=${coverage.lines}`);
        }
    }

    // Handle reporters
    for (const reporter of options?.reporter ?? []) {
        params.push(`--test-reporter=${reporter.name}`);
        const destination = reporter.destination == null || reporter.destination.trim() === "" ? "stdout" : reporter.destination;
        params.push(`--test-reporter-destination=${destination}`);
    }

    // Handle test name pattern matching
    for (const namePattern of [ options?.testPattern ?? []].flat()) {
        params.push(`--test-name-pattern=${namePattern}`);
    }
    for (const skipPattern of [ options?.skipPattern ?? []].flat()) {
        params.push(`--test-skip-pattern=${skipPattern}`);
    }

    // Handle other options
    if (options?.isolation != null) {
        if (nodeVersion < 24) {
            params.push(`--experimental-test-isolation=${options.isolation}`);
        } else {
            params.push(`--test-isolation=${options.isolation}`);
        }
    }
    if (options?.moduleMocks === true) {
        params.push("--experimental-test-module-mocks");
    }
    if (options?.concurrency != null) {
        params.push(`--test-concurrency=${options.concurrency}`);
    }
    if (options?.forceExit === true) {
        params.push("--test-force-exit");
    }
    if (options?.only === true) {
        params.push("--test-only");
    }
    if (options?.shard != null) {
        params.push(`--test-shard=${options.shard}`);
    }
    if (options?.timeout != null) {
        params.push(`--test-timeout=${options.timeout}`);
    }
    if (options?.updateSnapshots === true) {
        params.push("--test-update-snapshots");
    }
    if (options?.rerunFailures != null) {
        params.push(`--test-rerun-failures=${options.rerunFailures}`);
    }
    if (options?.globalSetup != null) {
        params.push(`--test-global-setup=${options.globalSetup}`);
    }
    if (options?.watch === true) {
        params.push("--watch");
    }

    // Append test file globs
    for (const pattern of [ options?.files ?? []].flat()) {
        params.push(pattern);
    }

    // Run Node Test
    await spawnNode(io, params);
}

/**
 * Main function.
 *
 * @param args - The command line arguments (`process.argv.slice(2)`)
 * @param io   - Optional custom stdout/stderr streams. Defaults to Node.js `process`.
 * @returns The exit code
 */
export async function main(args: string[], io: IO = process): Promise<number> {
    try {
        const { values, positionals } = parseArgs({
            args,
            allowPositionals: true,
            allowNegative: true,
            strict: true,
            options: {
                config: { type: "string", short: "c" },
                concurrency: { type: "string" },
                coverage: { type: "boolean"  },
                "coverage-branches": { type: "string" },
                "coverage-functions": { type: "string" },
                "coverage-lines": { type: "string" },
                "coverage-exclude": { type: "string", multiple: true },
                "coverage-include": { type: "string", multiple: true },
                "force-exit": { type: "boolean" },
                "global-setup": { type: "string" },
                "isolation": { type: "string" },
                "module-mocks": { type: "boolean" },
                only: { type: "boolean" },
                reporter: { type: "string", multiple: true },
                "rerun-failures": { type: "string" },
                shard: { type: "string" },
                "skip-pattern": { type: "string", multiple: true, short: "s" },
                "test-pattern": { type: "string", multiple: true, short: "t" },
                timeout: { type: "string" },
                "update-snapshots": { type: "boolean", short: "u" },
                watch: { type: "boolean", short: "w" },
                help: { type: "boolean" },
                version: { type: "boolean" }
            }
        });

        if (values.help === true) {
            io.stdout.write(help);
            return 0;
        }

        if (values.version === true) {
            io.stdout.write(version);
            return 0;
        }

        // Read config file or 'ntest' section from package.json
        const options = await readConfig(values.config);

        // Overwrite config entries with command line options if present
        options.coverage ??= {};
        if (values.coverage != null) {
            options.coverage.enabled = values.coverage;
        }
        if (values["coverage-branches"] != null) {
            options.coverage.branches = Number(values["coverage-branches"]);
        }
        if (values["coverage-functions"] != null) {
            options.coverage.functions = Number(values["coverage-functions"]);
        }
        if (values["coverage-lines"] != null) {
            options.coverage.lines = Number(values["coverage-lines"]);
        }
        if (values["coverage-exclude"] != null) {
            options.coverage.exclude = values["coverage-exclude"];
        }
        if (values["coverage-include"] != null) {
            options.coverage.include = values["coverage-include"];
        }
        if (values.concurrency != null) {
            options.concurrency = Number(values.concurrency);
        }
        if (values["force-exit"] != null) {
            options.forceExit = values["force-exit"];
        }
        if (values["global-setup"] != null) {
            options.globalSetup = values["global-setup"];
        }
        if (values.isolation != null) {
            options.isolation = values.isolation as typeof options.isolation;
        }
        if (values.only != null) {
            options.only = values.only;
        }
        if (values["module-mocks"] != null) {
            options.moduleMocks = values["module-mocks"];
        }
        if (values.reporter != null) {
            options.reporter = values.reporter.map(reporter => {
                const [ name, ...destination ] = reporter.split(":");
                return { name, destination: destination.join(":") };
            })
        };
        if (values["rerun-failures"] != null) {
            options.rerunFailures = values["rerun-failures"];
        }
        if (values.shard != null) {
            options.shard = values.shard;
        }
        if (values["skip-pattern"] != null) {
            options.skipPattern = values["skip-pattern"];
        }
        if (values["test-pattern"] != null) {
            options.testPattern = values["test-pattern"];
        }
        if (values.timeout != null) {
            options.timeout = Number(values.timeout);
        }
        if (values["update-snapshots"] != null) {
            options.updateSnapshots = values["update-snapshots"];
        }
        if (values.watch != null) {
            options.watch = values.watch;
        }
        if (positionals.length > 0) {
            options.files = positionals;
        }

        // Run the tests
        await runNodeTest(io, options);

        // Tests successful
        return 0;
    } catch (error) {
        // Tests failed
        io.stderr.write(`${commandName}: ${getErrorMessage(error)}\n`);
        return 1;
    }
}

if (import.meta.main) {
    process.exitCode = await main(process.argv.slice(2));
}
