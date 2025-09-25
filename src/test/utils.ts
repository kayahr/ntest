/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import type { it } from "node:test";
import cp from "node:child_process";
import { chdir, cwd } from "node:process";
import { join } from "node:path";

/**
 * Provides a captured {@link stdout} and {@link stderr} stream which can be passed to the main function to capture output.
 */
export class IOCapture {
    /** The capturing stdout stream. */
    readonly stdout = new PassThrough();

    /** The capturing stderr stream. */
    readonly stderr = new PassThrough();

    /** The captured stdout text. */
    public capturedStdout = "";

    /** The captured stderr text. */
    public capturedStderr = "";

    public constructor() {
        this.stdout.setEncoding("utf8").on("data", data => (this.capturedStdout += data));
        this.stderr.setEncoding("utf8").on("data", data => (this.capturedStderr += data));
    }
}

export function captureSpawn(t: it.TestContext): unknown[] {
    let capturedParams: unknown[] = [];
    t.mock.method(cp, "spawn", (command: string, params: unknown[]) => {
        capturedParams.push(...params);
        const fake = new EventEmitter();
        queueMicrotask(() => {
            fake.emit("close", 0);
        });
        return fake;
    });
    return capturedParams;
}

export async function withCwd<T>(dir: string, callback: () => Promise<T>): Promise<T> {
    const orig = cwd();
    try {
        chdir(dir);
        return await callback();
    } finally {
        process.chdir(orig);
    }
}

export function withProject<T>(project: string, callback: () => Promise<T>): Promise<T> {
    return withCwd(join("src/test/fixtures", project), callback);
}
