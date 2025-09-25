/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { captureSpawn, IOCapture, withCwd, withProject } from "./utils.ts";
import { main } from "../main/ntest.ts";
import { spawn } from "node:child_process";

const mappings: Array<{ ntest: string[], node: string[], nodeVersion?: number }> = [
    {
        ntest: [ "--coverage", "--coverage-branches=13" ],
        node: [ "--experimental-test-coverage", "--test-coverage-branches=13" ]
    },
    {
        ntest: [ "--coverage", "--coverage-functions=14" ],
        node: [ "--experimental-test-coverage", "--test-coverage-functions=14" ]
    },
    {
        ntest: [ "--coverage", "--coverage-lines=15" ],
        node: [ "--experimental-test-coverage", "--test-coverage-lines=15" ]
    },
    {
        ntest: [ "--coverage", "--coverage-include=foo", "--coverage-include=bar" ],
        node: [ "--experimental-test-coverage", "--test-coverage-include=foo", "--test-coverage-include=bar" ]
    },
    {
        ntest: [ "--coverage", "--coverage-exclude=foo2", "--coverage-exclude=bar2" ],
        node: [ "--experimental-test-coverage", "--test-coverage-exclude=foo2", "--test-coverage-exclude=bar2" ]
    },
    {
        ntest: [ "--concurrency=3" ],
        node: [ "--test-concurrency=3" ]
    },
    {
        ntest: [ "--force-exit" ],
        node: [ "--test-force-exit" ]
    },
    {
        ntest: [ "--global-setup=setup.js" ],
        node: [ "--test-global-setup=setup.js" ]
    },
    {
        nodeVersion: 24,
        ntest: [ "--isolation=process" ],
        node: [ "--test-isolation=process" ]
    },
    {
        nodeVersion: 22,
        ntest: [ "--isolation=process" ],
        node: [ "--experimental-test-isolation=process" ]
    },
    {
        ntest: [ "--module-mocks" ],
        node: [ "--experimental-test-module-mocks" ]
    },
    {
        ntest: [ "--only" ],
        node: [ "--test-only" ]
    },
    {
        ntest: [ "--reporter=spec" ],
        node: [ "--test-reporter=spec", "--test-reporter-destination=stdout" ]
    },
    {
        ntest: [ "--reporter=spec", "--reporter=lcov:C:/lcov.info" ],
        node: [
            "--test-reporter=spec", "--test-reporter-destination=stdout",
            "--test-reporter=lcov", "--test-reporter-destination=C:/lcov.info"
        ]
    },
    {
        ntest: [ "--rerun-failures=state" ],
        node: [ "--test-rerun-failures=state" ]
    },
    {
        ntest: [ "--shard=1/3" ],
        node: [ "--test-shard=1/3" ]
    },
    {
        ntest: [ "--skip-pattern=foo", "-s", "bar" ],
        node: [ "--test-skip-pattern=foo", "--test-skip-pattern=bar" ]
    },
    {
        ntest: [ "--test-pattern=foo", "-t", "bar" ],
        node: [ "--test-name-pattern=foo", "--test-name-pattern=bar" ]
    },
    {
        ntest: [ "--timeout", "1234" ],
        node: [ "--test-timeout=1234" ]
    },
    {
        ntest: [ "--update-snapshots" ],
        node: [ "--test-update-snapshots" ]
    },
    {
        ntest: [ "-u" ],
        node: [ "--test-update-snapshots" ]
    },
    {
        ntest: [ "--watch" ],
        node: [ "--watch" ]
    },
    {
        ntest: [ "-w" ],
        node: [ "--watch" ]
    }
];

describe("ntest", () => {
    let io: IOCapture;

    beforeEach(() => {
        io = new IOCapture();
    });

    it("can be called as CLI tool", async () => {
        const exitCode = await new Promise<number>((resolve, reject) => {
            const child = spawn("node", [ "./src/main/ntest.ts", "--", "--version" ], { stdio: [ "inherit", "pipe", "pipe" ] });
            child.stdout.pipe(io.stdout, { end: false });
            child.stderr.pipe(io.stderr, { end: false });
            child.on("error", reject);
            child.on("close", resolve)
        });
        assert.equal(exitCode, 0);
        assert.equal(io.capturedStdout, `v${process.versions.node}\n`);
        assert.equal(io.capturedStderr, "");
    });

    it("shows help on --help option", async () => {
        const result = await main(io, [ "--help" ]);
        assert.equal(result, 0);
        assert.equal(io.capturedStderr, "");
        assert.match(io.capturedStdout, /^Usage: ntest /);
    });
    it("shows version information on --version option", async () => {
        const result = await main(io, [ "--version" ]);
        assert.equal(result, 0);
        assert.equal(io.capturedStderr, "");
        assert.match(io.capturedStdout, /^ntest [0-9]+\.[0-9]+\.[0-9]+\n/);
    });
    it("passes through options to Node after '--' separator", async (t) => {
        const params = captureSpawn(t);
        await withProject("empty-project", () => main(io, [ "--", "--help" ]));
        assert.equal(params.at(-1), "--help");
    });
    it("runs Node Test with default options when no other options are given", async (t) => {
        const params = captureSpawn(t);
        await withProject("empty-project", async () => {
            await main(io, []);
        });
        assert.deepEqual(params, [ "--test" ]);
    });
    describe("converts ntest options to node options", () => {
        for (const mapping of mappings) {
            it(`'${mapping.ntest.join(" ")}' -> '${mapping.node.join(" ")}'`, async (t) => {
                if (mapping.nodeVersion != null) {
                    t.mock.property(process.versions, "node", `${mapping.nodeVersion}.0.0`);
                }
                const params = captureSpawn(t);
                await withProject("empty-project", async () => {
                    await main(io, mapping.ntest);
                });
                assert.deepEqual(params, [ "--test", ...mapping.node ]);
            });
        }
    });
    it("throws error when no package root could be found", async () => {
        const result = await withCwd("/tmp", () => main(io, []));
        assert.equal(io.capturedStderr, "ntest: Unable to locate package.json\n");
        assert.equal(io.capturedStdout, "");
        assert.equal(result, 1);
    });
    it("throws error when passing invalid option to node", async () => {
        const result = await withProject("empty-project", () => main(io, [ "--", "--wrong-param" ]));
        assert.equal(io.capturedStderr, "node: bad option: --wrong-param\nntest: Node exited with code 9\n");
        assert.equal(io.capturedStdout, "");
        assert.equal(result, 1);
    });
    it("throws error when config can not be parsed", async () => {
        const result = await withProject("broken-config", () => main(io, []));
        assert.match(io.capturedStderr, /^ntest: Error while reading config '.*ntest\.json': /);
        assert.equal(io.capturedStdout, "");
        assert.equal(result, 1);
    });
    it("runs Node Test with default options when configuration is empty", async (t) => {
        const params = captureSpawn(t);
        await withProject("empty-config", () => main(io, []));
        assert.deepEqual(params, [ "--test" ]);
    });
    it("runs Node Test with correct options from small configuration", async (t) => {
        const params = captureSpawn(t);
        await withProject("small-config", () => main(io, []));
        assert.deepEqual(params, [
            "--test",
            "--experimental-test-coverage",
            "src/test/**/*.test.ts",
        ]);
    });
    it("runs Node Test with correct options from package.json configuration", async (t) => {
        const params = captureSpawn(t);
        await withProject("package-config", () => main(io, []));
        assert.deepEqual(params, [
            "--test",
            "--experimental-test-coverage",
            "src/test/**/*.test.js",
        ]);
    });
    it("runs Node Test with correct options from a custom configuration file using --config option", async (t) => {
        const params = captureSpawn(t);
        await withProject("custom-config", () => main(io, [ "--config", "ntest.config.json" ]));
        assert.deepEqual(params, [
            "--test",
            "foo.js",
        ]);
    });
    it("runs Node Test with correct options from a custom configuration file using -c option", async (t) => {
        const params = captureSpawn(t);
        await withProject("custom-config", () => main(io, [ "-c", "ntest.config.json" ]));
        assert.deepEqual(params, [
            "--test",
            "foo.js",
        ]);
    });
    it("runs Node Test with correct options from big configuration", async (t) => {
        const params = captureSpawn(t);
        await withProject("big-config", () => main(io, []));
        assert.deepEqual(params, [
            "--test",
            "--test-reporter=dot",
            "--test-reporter-destination=stdout",
            "--test-reporter=junit",
            "--test-reporter-destination=C:/junit.xml",
            "--test-name-pattern=test1",
            "--test-name-pattern=test2",
            "--test-skip-pattern=skip1",
            "--test-skip-pattern=skip2",
            "--test-isolation=none",
            "--experimental-test-module-mocks",
            "--test-concurrency=12",
            "--test-force-exit",
            "--test-only",
            "--test-shard=2/4",
            "--test-timeout=1234",
            "--test-update-snapshots",
            "--test-rerun-failures=state",
            "--test-global-setup=global.js",
            "--watch",
            "files1",
            "files2",
        ]);
    });
});
