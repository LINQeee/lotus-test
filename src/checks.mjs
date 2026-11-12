import fs from 'node:fs'
import {config} from './config.mjs'
import {metadataSchema} from './schema.mjs'

const startMarker = '###### RUNNING main():\n'
const endMarker = '\n\n###### EXECUTED MAIN FUNCTION'

export const readMetadata = file => {
    const data = {}, locations = new Map()
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    const diagnostic = (line, message) => `${file}:${line + 1}: ${message}\n    ${lines[line] ?? ''}`
    const invalid = message => new Error(`DIRECTIVE ERROR — test not executed\n${message}`)
    for (const [index, line] of lines.entries()) {
        const match = line.match(/^\s*\/\/\s*([\w-]+)\s*:\s*(.*)$/)
        if (!match) continue
        const [, key, value] = match
        if (Object.hasOwn(data, key))
            throw invalid(diagnostic(index, `Duplicate directive "${key}"; first declared on line ${locations.get(key) + 1}`))
        locations.set(key, index)
        try {
            data[key] = JSON.parse(value)
        } catch {
            throw invalid(diagnostic(index, `Directive "${key}" requires a JSON value (strings must use double quotes)`))
        }
    }
    const result = metadataSchema.safeParse(data)
    if (!result.success)
        throw invalid(result.error.issues.map(issue => {
            const key = issue.path[0] ?? issue.keys?.[0]
            const line = locations.get(key) ?? locations.get('expect') ?? locations.get('error') ?? locations.get('runtime-error') ?? 0
            const field = issue.path.length ? `Directive "${issue.path.join('.')}" — ` : ''
            return diagnostic(line, field + issue.message)
        }).join('\n'))
    return {runtime: config.runtime, 'entry-allocas': config.entryAllocas, ...data}
}

export const checkResult = (data, {out, err, code, signal, timedOut}) => {
    if (timedOut) return 'Timed out'
    if (signal) return `Process killed by ${signal}`
    const log = out + err
    if (Object.hasOwn(data, 'runtime-error')) {
        if (code !== 1) return `Expected runtime error (exit 1), got ${code}`
        if (!out.includes(startMarker)) return 'Expected runtime error, but execution did not start'
        if (!err.includes(data['runtime-error'])) return `Missing diagnostic: ${data['runtime-error']}`
    } else if (Object.hasOwn(data, 'error')) {
        if (code !== 1) return `Expected compiler error (exit 1), got ${code}`
        if (out.includes(startMarker)) return 'Expected rejection before execution, but program ran'
        if (!log.includes(data.error)) return `Missing diagnostic: ${data.error}`
    } else {
        if (code !== 0) return `Unexpected exit ${code}`
        const start = out.indexOf(startMarker)
        const end = out.indexOf(endMarker, start + startMarker.length)
        if (start < 0 || end < 0) return 'Missing execution markers (program did not finish)'
        const actual = out.slice(start + startMarker.length, end)
        if (actual !== data.expect) return `Output differs\n    expected: ${JSON.stringify(data.expect)}\n    actual:   ${JSON.stringify(actual)}`
    }
    for (const text of data.log ?? []) if (!log.includes(text)) return `Missing log: ${text}`
    for (const text of data['no-log'] ?? []) if (log.includes(text)) return `Unexpected log: ${text}`
    const ir = (out.split('###### GENERATED IR:\n')[1] ?? '').split(startMarker)[0]
    for (const text of data.ir ?? []) if (!ir.includes(text)) return `Missing IR: ${text}`
    if (data['entry-allocas']) {
        let block
        for (const line of ir.split('\n')) {
            if (/^[\w.]+:/.test(line)) block = line.split(':')[0]
            if (line.includes(' = alloca ') && block !== 'entry') return `Stack allocation outside entry: ${line.trim()}`
        }
    }
    return null
}
