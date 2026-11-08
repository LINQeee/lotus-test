import fs from 'node:fs'
import path from 'node:path'
import {parseArgs} from 'node:util'
import {configSchema, validate} from './schema.mjs'

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

    Object.assign(config, validate(configSchema, config))
    for (const key of ['testsDir', 'resultsDir', 'compiler', 'runtimeBuild', 'runtimeLibrary'])
        config[key] = path.resolve(key === 'compiler' && options.compiler !== undefined ? process.cwd() : project, config[key])
    if (config.cmake.includes('/') || config.cmake.includes('\\')) config.cmake = path.resolve(project, config.cmake)
    return {options, positionals}
}
