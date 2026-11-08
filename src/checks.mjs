import fs from 'node:fs'
import {config} from './config.mjs'

const startMarker = '###### RUNNING main():\n'
const endMarker = '\n\n###### EXECUTED MAIN FUNCTION'

export const readMetadata = file => {
    const data = {}
    const strings = ['expect', 'error', 'input', 'runtime']
    const lists = ['ir', 'log', 'no-log']
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const match = line.match(/^\/\/ ([a-z-]+): (.*)$/)
        if (!match) continue
        const [, key, value] = match
        if (![...strings, ...lists, 'entry-allocas'].includes(key)) throw new Error(`Unknown directive ${key}`)
        if (Object.hasOwn(data, key)) throw new Error(`Duplicate directive ${key}`)
        data[key] = JSON.parse(value)
        if (strings.includes(key) && typeof data[key] !== 'string') throw new Error(`${key} must be a string`)
        if (lists.includes(key) && !(Array.isArray(data[key]) && data[key].every(v => typeof v === 'string')))
            throw new Error(`${key} must be an array of strings`)
        if (key === 'entry-allocas' && typeof data[key] !== 'boolean') throw new Error(`${key} must be boolean`)
    }
    if (Object.hasOwn(data, 'expect') === Object.hasOwn(data, 'error')) throw new Error('Specify exactly one of expect or error')
    if (!['normal', 'none', 'memory'].includes(data.runtime ?? 'normal')) throw new Error('Invalid runtime')
    return {runtime: config.runtime, 'entry-allocas': config.entryAllocas, ...data}
}

export const checkResult = (data, {out, err, code, signal, timedOut}) => {
    if (timedOut) return 'Timed out'
    if (signal) return `Process killed by ${signal}`
    const log = out + err
    if (Object.hasOwn(data, 'error')) {
        if (code !== 1) return `Expected compiler error (exit 1), got ${code}`
        if (out.includes(startMarker)) return 'Expected rejection before execution, but program ran'
        if (!log.includes(data.error)) return `Missing diagnostic: ${data.error}`
    } else {
        if (code !== 0) return `Unexpected exit ${code}`
        const start = out.indexOf(startMarker)
        const end = out.indexOf(endMarker, start + startMarker.length)
        if (start < 0 || end < 0) return 'Missing execution markers (compiler/JIT did not finish)'
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
