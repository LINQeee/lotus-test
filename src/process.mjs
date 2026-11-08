import fs from 'node:fs'
import {spawn} from 'node:child_process'
import {config, project} from './config.mjs'

export const execute = (command, cwd, input = '', env = {}, timeout = config.setupTimeout) =>
    new Promise((resolve, reject) => {
        const child = spawn(command[0], command.slice(1), {
            cwd, env: {...process.env, ...env}, detached: true,
        })
        const stdout = [], stderr = []
        let timedOut = false
        const timer = setTimeout(() => {
            timedOut = true
            try {
                process.kill(-child.pid, 'SIGKILL')
            } catch (error) {
                if (error.code !== 'ESRCH') reject(error)
            }
        }, timeout * 1000)
        child.stdout.on('data', chunk => stdout.push(chunk))
        child.stderr.on('data', chunk => stderr.push(chunk))
        child.stdin.on('error', error => {
            if (error.code !== 'EPIPE') reject(error)
        })
        child.on('error', error => {
            clearTimeout(timer)
            reject(error)
        })
        child.on('close', (code, signal) => {
            clearTimeout(timer)
            resolve({
                out: Buffer.concat(stdout).toString(),
                err: Buffer.concat(stderr).toString(),
                code,
                signal,
                timedOut
            })
        })
        child.stdin.end(input)
    })

export const setup = async (command, log) => {
    const result = await execute(command, project).catch(error => {
        if (error.code === 'ENOENT') {
            const option = command[0] === (process.env.CMAKE ?? config.cmake) ? 'CMAKE' : 'CC'
            throw new Error(`Cannot find ${command[0]}. Install it and add it to PATH, or set ${option} to its executable path.`)
        }
        throw error
    })
    fs.writeFileSync(log, result.out + result.err)
    if (result.code !== 0 || result.timedOut) throw new Error(`Setup failed: ${log}`)
    return result.out.trim()
}
