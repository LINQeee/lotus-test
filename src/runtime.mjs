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

export const prepareRuntime = async (runtime, temp, logs) => {
    if (runtime !== 'memory') {
        const libs = path.join(temp, runtime)
        if (runtime === 'normal' && !fs.existsSync(config.runtimeLibrary))
            throw new Error('Runtime library missing; run without --no-build')
        fs.mkdirSync(libs, {recursive: true})
        if (runtime === 'normal') fs.symlinkSync(config.runtimeLibrary, path.join(libs, path.basename(config.runtimeLibrary)))
        return {libs}
    }
    const cc = process.env.CC ?? 'clang'
    const cmake = process.env.CMAKE ?? config.cmake
    const build = path.join(temp, 'memory-build')
    await setup([cmake, '-S', fileURLToPath(new URL('./memory', import.meta.url)), '-B', build,
        `-DLOTUS_CORE_SOURCE=${path.join(project, 'lotus-core')}`, `-DCMAKE_C_COMPILER=${cc}`],
        path.join(logs, 'memory-configure.log'))
    await setup([cmake, '--build', build, '--target', 'lotus_core'], path.join(logs, 'memory-build.log'))
    const resource = await setup([cc, '-print-resource-dir'], path.join(logs, 'clang-resource.log'))
    return {
        libs: path.join(build, 'lib'),
        env: {
            DYLD_INSERT_LIBRARIES: path.join(resource, 'lib/darwin/libclang_rt.asan_osx_dynamic.dylib'),
            ASAN_OPTIONS: 'detect_leaks=0:abort_on_error=1',
            UBSAN_OPTIONS: 'halt_on_error=1'
        }
    }
}
