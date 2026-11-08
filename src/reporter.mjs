import path from 'node:path'
import ora from 'ora'
import {Chalk} from 'chalk'

const chalk = new Chalk({level: 1})

export class Reporter {
    constructor(verbose) {
        this.verbose = verbose
        this.total = 0
        this.failed = 0
        this.spinner = ora({stream: process.stdout, color: false, discardStdin: false, isEnabled: true})
    }

    start(name) {
        const group = path.isAbsolute(name) ? path.dirname(name) : name.split(path.sep)[0]
        if (this.group?.name !== group) {
            this.finishGroup()
            this.group = {name: group, total: 0, failed: 0, started: performance.now()}
        }
        if (!process.stdout.isTTY || process.env.TERM === 'dumb' || this.verbose) return
        this.spinner.start(chalk.cyan(name))
    }

    stop() {
        if (this.spinner.isSpinning) this.spinner.stop()
    }

    finish(name, ms, failure) {
        this.stop()
        this.total++
        this.group.total++
        if (failure) {
            this.failed++
            this.group.failed++
        }
        if (this.verbose || failure)
            console.log(`  ${failure ? chalk.red('✗ FAIL') : chalk.green('✓ PASS')} ${name} (${ms.toFixed(1)} ms)`)
    }

    finishGroup() {
        if (!this.group) return
        const {name, total, failed, started} = this.group
        const seconds = (performance.now() - started) / 1000
        const color = failed ? chalk.red : chalk.green
        console.log(color(`${failed ? '✗ FAIL' : '✓ PASS'} ${name} · ${total - failed}/${total} · ${seconds.toFixed(2)} s`))
        this.group = null
    }

    report(seconds) {
        this.stop()
        this.finishGroup()
        const {total, failed} = this
        const summary = `${total - failed} passed · ${failed} failed · ${total} total · ${seconds.toFixed(2)} s`
        console.log(`\n${failed ? chalk.bold.red(summary) : chalk.bold.green(summary)}`)
    }
}
