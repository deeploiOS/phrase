import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/fileUtils', () => ({
    prepareTmpDir: vi.fn(),
    clearTmpDir: vi.fn(),
}))

vi.mock('../src/lib', () => ({
    setPhraseProjectId: vi.fn(),
    downloadLocale: vi.fn(),
    composeLocalLocaleFile: vi.fn(),
    findModifiedTranslationKeys: vi.fn(),
    initiateUserDialog: vi.fn(),
    getJobs: vi.fn(),
    createTranslationKey: vi.fn(),
    updateTranslationKey: vi.fn(),
    deleteTranslationKey: vi.fn(),
    createPhraseJob: vi.fn(),
    updatePhraseJob: vi.fn(),
    UserAction: {
        DO_NOT_CREATE: 'DO_NOT_CREATE',
        CREATE_NEW: 'CREATE_NEW',
    },
}))

import push from '../src/push'
import * as lib from '../src/lib'

const setupBase = () => {
    vi.mocked(lib.downloadLocale).mockResolvedValue({})
    vi.mocked(lib.composeLocalLocaleFile).mockResolvedValue({})
    vi.mocked(lib.getJobs).mockResolvedValue([])
    vi.mocked(lib.initiateUserDialog).mockResolvedValue({
        phraseJob: 'DO_NOT_CREATE',
        jiraTicketId: undefined,
        jobName: undefined,
        jobDescription: undefined,
        jobDueDateNumber: undefined,
    })
}

const pushArgs = {
    phraseProjectName: 'test',
    phraseProjectId: 'test-id',
    localesDirPath: '/test/locales',
}

describe('push', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('allowDelete', () => {
        it('skips deletion and logs a message when allowDelete is false', async () => {
            setupBase()
            const consoleSpy = vi.spyOn(console, 'log')
            vi.mocked(lib.findModifiedTranslationKeys).mockResolvedValue({
                added: { 'common.newKey': 'New Key' },
                updated: {},
                deleted: { 'common.oldKey': undefined },
            })
            vi.mocked(lib.createTranslationKey).mockResolvedValue(undefined)

            await push({ ...pushArgs, allowDelete: false })

            expect(lib.deleteTranslationKey).not.toHaveBeenCalled()
            expect(consoleSpy).toHaveBeenCalledWith(
                'Skipping deletion of "common.oldKey" — pass allowDelete: true to remove it from Phrase'
            )
        })

        it('deletes keys when allowDelete is true', async () => {
            setupBase()
            vi.mocked(lib.findModifiedTranslationKeys).mockResolvedValue({
                added: { 'common.newKey': 'New Key' },
                updated: {},
                deleted: { 'common.oldKey': undefined },
            })
            vi.mocked(lib.createTranslationKey).mockResolvedValue(undefined)

            await push({ ...pushArgs, allowDelete: true })

            expect(lib.deleteTranslationKey).toHaveBeenCalledWith('common.oldKey')
        })
    })
})
