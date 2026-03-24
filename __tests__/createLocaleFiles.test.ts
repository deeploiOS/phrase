import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const { testTempDir } = vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const os = require('node:os')
    return { testTempDir: path.join(os.tmpdir(), 'phrase-vitest') as string }
})

vi.mock('../src/config', () => ({
    tempDirPath: testTempDir,
    phraseApiToken: 'test-token',
    supportedLocales: ['en', 'de'],
}))

import { createLocaleFiles } from '../src/lib'

describe('createLocaleFiles', () => {
    let testLocalesDir: string

    beforeEach(() => {
        testLocalesDir = path.join(os.tmpdir(), `phrase-test-locales-${Date.now()}`)
        fs.mkdirSync(path.join(testLocalesDir, 'en'), { recursive: true })
        fs.mkdirSync(testTempDir, { recursive: true })
    })

    afterEach(() => {
        delete require.cache[path.join(testTempDir, 'en.json')]
        fs.rmSync(testLocalesDir, { recursive: true, force: true })
        fs.rmSync(testTempDir, { recursive: true, force: true })
    })

    it('writes phrase data to locale files', async () => {
        fs.writeFileSync(
            path.join(testTempDir, 'en.json'),
            JSON.stringify({ common: { hello: 'Hello', world: 'World' } })
        )

        await createLocaleFiles({ locale: 'en', localesDirPath: testLocalesDir })

        const result = JSON.parse(
            fs.readFileSync(path.join(testLocalesDir, 'en', 'common.json'), 'utf-8')
        )
        expect(result).toEqual({ hello: 'Hello', world: 'World' })
    })

    it('adds a trailing newline to generated files', async () => {
        fs.writeFileSync(
            path.join(testTempDir, 'en.json'),
            JSON.stringify({ common: { hello: 'Hello' } })
        )

        await createLocaleFiles({ locale: 'en', localesDirPath: testLocalesDir })

        const raw = fs.readFileSync(path.join(testLocalesDir, 'en', 'common.json'), 'utf-8')
        expect(raw.endsWith('\n')).toBe(true)
    })

    describe('preserveLocalKeys', () => {
        it('preserves locally-added keys not yet in Phrase', async () => {
            fs.writeFileSync(
                path.join(testTempDir, 'en.json'),
                JSON.stringify({ common: { hello: 'Hello', world: 'World' } })
            )
            fs.writeFileSync(
                path.join(testLocalesDir, 'en', 'common.json'),
                JSON.stringify({ hello: 'Hello', newKey: 'New Local Key' })
            )

            await createLocaleFiles({
                locale: 'en',
                localesDirPath: testLocalesDir,
                preserveLocalKeys: true,
            })

            const result = JSON.parse(
                fs.readFileSync(path.join(testLocalesDir, 'en', 'common.json'), 'utf-8')
            )
            expect(result).toEqual({ hello: 'Hello', world: 'World', newKey: 'New Local Key' })
        })

        it('overwrites local files entirely when false', async () => {
            fs.writeFileSync(
                path.join(testTempDir, 'en.json'),
                JSON.stringify({ common: { hello: 'Hello', world: 'World' } })
            )
            fs.writeFileSync(
                path.join(testLocalesDir, 'en', 'common.json'),
                JSON.stringify({ hello: 'Hello', newKey: 'New Local Key' })
            )

            await createLocaleFiles({
                locale: 'en',
                localesDirPath: testLocalesDir,
                preserveLocalKeys: false,
            })

            const result = JSON.parse(
                fs.readFileSync(path.join(testLocalesDir, 'en', 'common.json'), 'utf-8')
            )
            expect(result).toEqual({ hello: 'Hello', world: 'World' })
        })

        it('writes phrase data as-is when no local file exists yet', async () => {
            fs.writeFileSync(
                path.join(testTempDir, 'en.json'),
                JSON.stringify({ common: { hello: 'Hello', world: 'World' } })
            )

            await createLocaleFiles({
                locale: 'en',
                localesDirPath: testLocalesDir,
                preserveLocalKeys: true,
            })

            const result = JSON.parse(
                fs.readFileSync(path.join(testLocalesDir, 'en', 'common.json'), 'utf-8')
            )
            expect(result).toEqual({ hello: 'Hello', world: 'World' })
        })
    })
})
