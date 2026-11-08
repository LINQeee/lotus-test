# Lotus test

Integration tests for the Lotus compiler. Requires Node.js 20+, CMake and the Lotus build toolchain. No npm dependencies.

```sh
npm install -g git+https://github.com/LINQeee/lotus-test.git
lotus-test
lotus-test loops/for
lotus-test --no-build --verbose
```

Run inside a Lotus checkout containing `lotus-test-config.json`, or any of its subdirectories. Paths in the config are relative to that file. `--compiler` paths are relative to the working directory.

## Options

| Option | Purpose |
| --- | --- |
| `--no-build` | Use existing compiler and runtime |
| `--compiler PATH` | Override the compiler executable |
| `--timeout SECONDS` | Override the per-test deadline |
| `-v`, `--verbose` | Print every result |
| `-h`, `--help` | Show usage within a configured project |

Tests use JSON-valued comments such as `// expect: "hello\n"` or `// error: "diagnostic"`. Optional directives: `input`, `runtime`, `ir`, `log`, `no-log`, `entry-allocas`. The runtime and entry-allocas defaults come from the project config.

Results are grouped by feature; failures include diagnostics and log paths. Exit codes: 0 for success, 1 for test failures, 2 for setup errors.

The runner currently uses the Lotus macOS runtime and sanitizer setup. Packaging it separately does not add Linux or Windows support. Memory tests compile against `lotus-core/lotus.h` and `lotus-core/library.c` from the tested project.

## Development

```sh
npm link
```

The `lotus-test` command then runs this checkout. Implementation lives in `src/`; language test cases belong in the compiler repository.
