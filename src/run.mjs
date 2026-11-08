import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {config, loadConfig} from './config.mjs'
import {execute} from './process.mjs'
import {readMetadata, checkResult} from './checks.mjs'
import {buildCompiler, prepareRuntime} from './runtime.mjs'
import {Reporter} from './reporter.mjs'

const findTests = file => {
    if (fs.statSync(file).isDirectory())
        return fs.readdirSync(file).flatMap(name => findTests(path.join(file, name)))
    return file.endsWith('.lt') ? [file] : []
}

const main = async () => {
    const {options, positionals} = loadConfig()
    const root = config.testsDir
    if (options.help) {
        console.log(`Usage: lotus-test [options] [feature directory or .lt file ...]
  --no-build          Use existing compiler/runtime
  --compiler PATH     Compiler executable
  --timeout SECONDS   Per-test timeout (default ${config.timeout})
  -v, --verbose       Print every test result
  -h, --help          Show this help`)
        return 0
    }
    const {timeout, compiler} = config
    const paths = positionals.length ? positionals.map(p => path.resolve(fs.existsSync(p) ? p : path.join(root, p))) : [root]
    for (const file of paths)
        if (!fs.statSync(file).isDirectory() && !file.endsWith('.lt')) throw new Error(`Not an .lt file: ${file}`)

    const files = [...new Set(paths.flatMap(findTests))].sort()
    if (!files.length) throw new Error('No .lt tests found')

    fs.mkdirSync(config.resultsDir, {recursive: true})

    const logs = fs.mkdtempSync(path.join(config.resultsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-`))
    const reporter = new Reporter(config.verbose)

    console.log(`Lotus tests: ${files.length}\nLogs: ${logs}`)
    if (config.build) await buildCompiler(compiler, logs)
    fs.accessSync(compiler, fs.constants.X_OK)
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lotus-tests-'))
    const started = performance.now()
    let failed = 0
    const memory = {}
    try {
        fs.mkdirSync(path.join(temp, 'run'))
        fs.mkdirSync(path.join(temp, 'libs'))
        for (const [index, file] of files.entries()) {
            const relative = path.relative(root, file)
            const name = relative.startsWith('../') ? file : relative
            reporter.start(name)
            const tick = performance.now()
            let failure = null, result = {out: '', err: ''}
            try {
                const data = readMetadata(file)
                const env = await prepareRuntime(data.runtime, temp, logs, memory)
                fs.copyFileSync(file, path.join(temp, 'test.lt'))
                result = await execute([compiler], path.join(temp, 'run'), data.input ?? '', env, timeout)
                failure = checkResult(data, result)
            } catch (error) {
                failure = error.message
            }
            const log = path.join(logs, `${String(index + 1).padStart(3, '0')}-${path.basename(file, '.lt')}.log`)
            fs.writeFileSync(log, `STDOUT\n${result.out}\nSTDERR\n${result.err}${failure ? `\nFAILURE\n${failure}\n` : ''}`)
            reporter.finish(name, performance.now() - tick, failure)
            if (failure) {
                failed++
                console.log(failure.split('\n').map(line => `    ${line}`).join('\n') + `\n    log: ${log}`)
                const output = (result.err || result.out).trimEnd()
                if (output) console.log(output.split('\n').slice(-8).map(line => `    ${line}`).join('\n'))
            }
        }
        reporter.report((performance.now() - started) / 1000)
    } finally {
        reporter.stop()
        fs.rmSync(temp, {recursive: true, force: true})
    }
    return failed ? 1 : 0
}

main().then(code => process.exitCode = code).catch(error => {
    console.error(`ERROR: ${error.message}`)
    process.exitCode = 2
})
