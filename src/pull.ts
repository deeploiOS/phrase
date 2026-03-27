import { clearTmpDir, prepareTmpDir } from './fileUtils'
import { supportedLocales } from './config'
import { downloadLocale, createLocaleFiles, setPhraseProjectId } from './lib'

const pull = async ({
    localesDirPath,
    phraseProjectId,
    preserveLocalKeys = true,
}: {
    localesDirPath: string
    phraseProjectId: string
    preserveLocalKeys?: boolean
}) => {
    setPhraseProjectId(phraseProjectId)

    prepareTmpDir()

    await Promise.all(supportedLocales.map((locale) => downloadLocale(locale)))

    await Promise.all(
        supportedLocales.map((locale) =>
            createLocaleFiles({
                locale,
                localesDirPath,
                preserveLocalKeys: preserveLocalKeys && locale === 'en',
            })
        )
    )

    clearTmpDir()

    console.log('Phrase translations are pulled')
}

export default pull
