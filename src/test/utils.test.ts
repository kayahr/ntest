/*
 * Copyright (c) 2025 Klaus Reimer
 * SPDX-License-Identifier: MIT
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import { getErrorMessage } from "../main/utils.ts";

describe("utils", () => {
    describe("getErrorMessage", () => {
        it("converts to string if parameter is not Error instance", () => {
            assert.equal(getErrorMessage(1234), "1234");
            assert.equal(getErrorMessage("foo"), "foo");
            assert.equal(getErrorMessage(true), "true");
        });
        it("returns message property value if parameter is Error instance", () => {
            assert.equal(getErrorMessage(new Error("test")), "test");
        });
    });
});
