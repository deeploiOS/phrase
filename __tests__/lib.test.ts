import { describe, it, expect } from 'vitest'

import { findModifiedTranslationKeys } from '../src/lib'

const phraseFileObjMock: Record<string, any> = {
    test: {
        qwe: {
            rty: 'first string',
            second: 'second string',
        }
    },
    some: {
        other: {
            key: 'third string',
        }
    },
    one_more: 'fourth string',
    to_delete: "should be deleted"
}

const localPhraseFileObjMock: Record<string, any> = {
    some: {
        other: {
            key: 'third string updated',
            new_key: 'new third key',
        }
    },
    one_more: 'fourth string',
    new_key: 'new key'
}

describe('lib', () => {
    describe('findModifiedTranslationKeys', () => {
        it('should correctly find added strings', async () => {
            expect((await findModifiedTranslationKeys(phraseFileObjMock, localPhraseFileObjMock)).added).toEqual({
                "new_key": "new key",
                "some.other.new_key": "new third key",
            })
        })

        it('should correctly find updated strings', async () => {
            expect((await findModifiedTranslationKeys(phraseFileObjMock, localPhraseFileObjMock)).updated).toEqual({
                "some.other.key": "third string updated",
            })
        })

        it('should correctly find deleted strings', async () => {
            expect((await findModifiedTranslationKeys(phraseFileObjMock, localPhraseFileObjMock)).deleted).toEqual({
                "test.qwe.rty": undefined,
                "test.qwe.second": undefined,
                "to_delete": undefined
            })
        })
    })
})
