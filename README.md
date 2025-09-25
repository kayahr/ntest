# ntest

[GitHub] | [NPM]

CLI wrapper for the [Node.js test runner] that adds configuration file support.

The Node.js test runner gets better with every Node.js release, but its command-line interface is clunky. To use it effectively, you often have to pass many long options to Node. `ntest` aims to solve this with a more intuitive CLI and configuration file support. Ideally, one day `ntest` won’t be necessary and you can use the Node CLI directly.

Note: `ntest` is a simple CLI wrapper. It translates its own options, and settings read from an optional configuration file, into Node command-line flags. As a result, ntest can only support features that are controllable via Node's CLI options. It does not use the programmatic Node.js test runner API.

## Usage

Install `ntest` as a dev dependency:

```
npm install -DE @kayahr/ntest
```

Use `ntest` in your `package.json`:

```json
{
  "scripts": {
    "test": "ntest"
  }
}
```

Write an `ntest.json` configuration file:

```json
{
    "$schema": "node_modules/@kayahr/ntest/ntest.schema.json",
    "files": "src/**/*.test.js",
    "reporter": [
        { "name": "spec" },
        { "name": "lcov", "destination": "lib/lcov.info" }
    ],
    "coverage": {
        "enabled": true
    }
}
```

Instead of `ntest.json` you can also name the file `.ntest.json` if you prefer hidden config files. Another alternative is adding the config (without the `$schema` property) to the `package.json` under the `ntest` property.

To list supported command line options run this:

```
npx ntest --help
```

Additional Node options can be passed after a `--` separator:

```
npx ntest --coverage -- --no-warnings
```

## Configuration

The configuration file supports the following settings:

```ts
{
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
     * Configures the type of test isolation. If set to 'process', each test file
     * is run in a separate child process. If set to 'none', all test files run
     * in the current process. Default: 'process'.
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
```

[GitHub]: https://github.com/kayahr/ntest
[NPM]: https://www.npmjs.com/package/@kayahr/ntest
[Node.js Test Runner]: https://nodejs.org/en/learn/test-runner/introduction
