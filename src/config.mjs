import fs from 'node:fs'
import path from 'node:path'
import {parseArgs} from 'node:util'

export let project
export const config = {}

export const loadConfig = () => {
    project = process.cwd()
    while (!fs.existsSync(path.join(project, 'lotus-test-config.json'))) {
        const parent = path.dirname(project)
        if (parent === project) throw new Error('Cannot find lotus-test-config.json in this directory or its parents')
        project = parent
    }
    Object.assign(config, JSON.parse(fs.readFileSync(path.join(project, 'lotus-test-config.json'), 'utf8')))
    const {values: options, positionals} = parseArgs({
        allowPositionals: true, options: {
            'no-build': {type: 'boolean'}, compiler: {type: 'string'}, timeout: {type: 'string'},
            verbose: {type: 'boolean', short: 'v'},
            help: {type: 'boolean', short: 'h'},
        }
    })

    if (options.compiler !== undefined) config.compiler = options.compiler
    if (options.timeout !== undefined) config.timeout = Number(options.timeout)
    if (options.verbose !== undefined) config.verbose = options.verbose
    if (options['no-build']) config.build = false

    const configOptions = {
        paths: ['testsDir', 'resultsDir', 'compiler', 'runtimeBuild', 'runtimeLibrary'],
        flags: ['build', 'verbose', 'entryAllocas'],
        timeouts: ['timeout', 'setupTimeout'],
        other: ['runtime', 'cmake']
    }

    for (const key of Object.keys(config))
        if (!Object.values(configOptions).flat().includes(key))
            throw new Error(`Unknown test config option: ${key}`)

    for (const key of configOptions.paths) {
        if (!config[key] || typeof config[key] !== 'string') throw new Error(`${key} must be a path`)
        config[key] = path.resolve(key === 'compiler' && options.compiler !== undefined ? process.cwd() : project, config[key])
    }
    for (const key of configOptions.flags)
        if (typeof config[key] !== 'boolean') throw new Error(`${key} must be boolean`)

    for (const key of configOptions.timeouts)
        if (!Number.isFinite(config[key]) || config[key] <= 0) throw new Error(`${key} must be a positive number`)

    if (typeof config.cmake !== 'string' || !config.cmake.trim()) throw new Error('cmake must be an executable name or path')
    if (config.cmake.includes('/') || config.cmake.includes('\\')) config.cmake = path.resolve(project, config.cmake)
    if (!['normal', 'none', 'memory'].includes(config.runtime)) throw new Error('runtime must be "normal", "none" or "memory"')
    return {options, positionals}
}
