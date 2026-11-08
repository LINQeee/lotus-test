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
        const cmake = process.env.CMAKE ?? config.cmake
        const build = path.join(temp, 'memory-build')
        await setup([cmake, '-S', fileURLToPath(new URL('./memory', import.meta.url)), '-B', build,
            `-DLOTUS_CORE_SOURCE=${path.join(project, 'lotus-core')}`, `-DCMAKE_C_COMPILER=${cc}`],
            path.join(logs, 'memory-configure.log'))
        await setup([cmake, '--build', build, '--target', 'lotus_core'], path.join(logs, 'memory-build.log'))
        const resource = await setup([cc, '-print-resource-dir'], path.join(logs, 'clang-resource.log'))
        memory.asan = path.join(resource, 'lib/darwin/libclang_rt.asan_osx_dynamic.dylib')
        memory.library = path.join(build, 'lib/libmemory.dylib')
    }
    fs.symlinkSync(memory.library, library)
    return {
        DYLD_INSERT_LIBRARIES: memory.asan,
        ASAN_OPTIONS: 'detect_leaks=0:abort_on_error=1',
        UBSAN_OPTIONS: 'halt_on_error=1'
    }
}
