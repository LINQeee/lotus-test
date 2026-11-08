import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {config, project} from './config.mjs'
import {setup} from './process.mjs'

export const buildCompiler = async (compiler, logs) => {
    const cmake = process.env.CMAKE ?? config.cmake
    for (const [build, source, target] of [
        [path.dirname(compiler), project, 'compiler'],
        [config.runtimeBuild, path.join(project, 'lotus-core'), 'lotus_core'],
    ]) {
        if (!fs.existsSync(path.join(build, 'CMakeCache.txt')))
            await setup([cmake, '-S', source, '-B', build], path.join(logs, `${target}-configure.log`))
        await setup([cmake, '--build', build, '--target', target], path.join(logs, `${target}-build.log`))
    }
}

export const prepareRuntime = async (runtime, temp, logs, memory) => {
    const library = path.join(temp, 'libs/liblotus_core.dylib')
    fs.rmSync(library, {force: true})
    if (runtime === 'none') return {}
    if (runtime !== 'memory') {
        const file = config.runtimeLibrary
        if (!fs.existsSync(file)) throw new Error('Runtime library missing; run without --no-build')
        fs.symlinkSync(file, library)
        return {}
    }
    if (!memory.library) {
        const cc = process.env.CC ?? 'clang'
        const output = path.join(temp, 'memory.dylib')
        await setup([cc, '-std=c11', '-g', '-O1', '-fsanitize=address,undefined', '-dynamiclib',
            '-I', path.join(project, 'lotus-core'),
            fileURLToPath(new URL('./string-memory-runtime.c', import.meta.url)), '-o', output], path.join(logs, 'memory-build.log'))
        const resource = await setup([cc, '-print-resource-dir'], path.join(logs, 'clang-resource.log'))
        memory.asan = path.join(resource, 'lib/darwin/libclang_rt.asan_osx_dynamic.dylib')
        memory.library = output
    }
    fs.symlinkSync(memory.library, library)
    return {
        DYLD_INSERT_LIBRARIES: memory.asan,
        ASAN_OPTIONS: 'detect_leaks=0:abort_on_error=1',
        UBSAN_OPTIONS: 'halt_on_error=1'
    }
}
