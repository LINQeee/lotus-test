import path from 'node:path'

export class Reporter {
    constructor(verbose) {
        this.verbose = verbose
        this.total = 0
        this.failed = 0
    }

    paint(text, color) {
        return `\x1b[${color}m${text}\x1b[0m`
    }

    start(name) {
        const group = path.isAbsolute(name) ? path.dirname(name) : name.split('/')[0]
        if (this.group?.name !== group) {
            this.finishGroup()
            this.group = {name: group, total: 0, failed: 0, started: performance.now()}
        }
        if (!process.stdout.isTTY || process.env.TERM === 'dumb' || this.verbose) return
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
        let frame = 0
        const draw = () => {
            const text = `${frames[frame++ % frames.length]} ${name}`
            process.stdout.write('\r\x1b[2K' + this.paint(text.slice(0, (process.stdout.columns || 80) - 1), '36'))
        }
        draw()
        this.spinner = setInterval(draw, 80)
    }

    stop() {
        if (!this.spinner) return
        clearInterval(this.spinner)
        this.spinner = null
        process.stdout.write('\r\x1b[2K')
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
            console.log(`  ${this.paint(failure ? '✗ FAIL' : '✓ PASS', failure ? '31' : '32')} ${name} (${ms.toFixed(1)} ms)`)
    }

    finishGroup() {
        if (!this.group) return
        const {name, total, failed, started} = this.group
        const seconds = (performance.now() - started) / 1000
        console.log(this.paint(`${failed ? '✗ FAIL' : '✓ PASS'} ${name} · ${total - failed}/${total} · ${seconds.toFixed(2)} s`, failed ? '31' : '32'))
        this.group = null
    }

    report(seconds) {
        this.stop()
        this.finishGroup()
        const {total, failed} = this
        const summary = `${total - failed} passed · ${failed} failed · ${total} total · ${seconds.toFixed(2)} s`
        console.log(`\n${this.paint(summary, failed ? '1;31' : '1;32')}`)
    }
}
