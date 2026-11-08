import {z} from 'zod'

const filename = z.string().min(1)
const runtime = z.enum(['normal', 'none', 'memory'])

export const configSchema = z.strictObject({
    testsDir: filename, resultsDir: filename, compiler: filename,
    runtimeBuild: filename, runtimeLibrary: filename,
    cmake: z.string().refine(value => value.trim().length > 0, 'Expected an executable name or path'),
    build: z.boolean(), verbose: z.boolean(), entryAllocas: z.boolean(),
    timeout: z.number().positive(), setupTimeout: z.number().positive(), runtime,
})

export const metadataSchema = z.strictObject({
    expect: z.string().optional(), error: z.string().optional(), input: z.string().optional(),
    runtime: runtime.optional(), 'entry-allocas': z.boolean().optional(),
    ir: z.array(z.string()).optional(), log: z.array(z.string()).optional(), 'no-log': z.array(z.string()).optional(),
}).refine(data => Object.hasOwn(data, 'expect') !== Object.hasOwn(data, 'error'), 'Specify exactly one of expect or error')

export const validate = (schema, data) => {
    const result = schema.safeParse(data)
    if (!result.success) throw new Error(z.prettifyError(result.error))
    return result.data
}
