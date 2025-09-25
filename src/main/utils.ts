/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import { access, constants } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Checks if given file exists.
 *
 * @param file - The file to check.
 * @returns True if file exists, false if not.
 */
export async function fileExists(file: string): Promise<boolean> {
    try {
        await access(file);
        return true;
    } catch {
        return false;
    }
}

/**
 * Searches the package root directory containing the nearest package.json file.
 *
 * @param dir - The directory to start searching in. Defaults to current working directory.
 * @returns The found package root directory.
 */
export async function findPackageRoot(dir = process.cwd()): Promise<string> {
    const candidate = join(dir, "package.json");
    try {
        await access(candidate, constants.F_OK);
        return dir;
    } catch {
        const parent = dirname(dir);
        if (parent === dir) {
            throw new Error("Unable to locate package.json");
        }
        return findPackageRoot(parent);
    }
}

/**
 * Returns the error message from the given error. If error is an Error instance then the message property is read from it. Otherwise the error is
 * converted to a string.
 *
 * @param error - The error to get the error message from.
 * @returns The error message from the given error.
 */
export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}
