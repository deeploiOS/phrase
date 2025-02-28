import { clearTmpDir, prepareTmpDir } from './fileUtils'
import { addDays } from 'date-fns'
import {
    getJobs,
    downloadLocale,
    composeLocalLocaleFile,
    findModifiedTranslationKeys,
    initiateUserDialog,
    updateTranslationKey,
    deleteTranslationKey,
    createTranslationKey,
    UserAction,
    createPhraseJob,
    updatePhraseJob,
    setPhraseProjectId,
} from './lib'
import { TranslationKey } from 'phrase-js'

const modifiedTranslationKeys: TranslationKey[] = []

const push = async ({
    phraseProjectName,
    phraseProjectId,
    localesDirPath,
}: {
    phraseProjectName: string
    phraseProjectId: string
    localesDirPath: string
}) => {
    setPhraseProjectId(phraseProjectId)

    prepareTmpDir()

    const phraseObj = await downloadLocale('en', false)
    const localObj = await composeLocalLocaleFile({
        locale: 'en',
        localesDirPath,
    })

    const jobs = await getJobs()

    const translationsDiff = await findModifiedTranslationKeys(phraseObj, localObj)

    if (
        Object.keys(translationsDiff.added).length +
            Object.keys(translationsDiff.updated).length +
            Object.keys(translationsDiff.deleted).length ===
        0
    ) {
        console.log('Nothing to push')
        process.exit(0)
    }

    const userInput = await initiateUserDialog({ jobs })

    for (const [name, value] of Object.entries(translationsDiff.added)) {
        console.log(`Creating translation key ${name} ${value}`)
        const result = await createTranslationKey({
            name,
            value: value as string,
        })
        if (result) {
            console.log(
                `Translation key ${result.key.id} was created. En translation id ${result.translation?.id} "${result.translation?.content}"`
            )
            if (result.key) {
                modifiedTranslationKeys.push(result.key)
            }
        }
    }

    for (const [name, value] of Object.entries(translationsDiff.updated)) {
        console.log(`Updating translation key ${name} ${value}`)
        const result = await updateTranslationKey({
            name,
            value: value as string,
        })
        if (result?.translation && result?.key) {
            console.log(
                `Translation key ${result.translation.id} was updated to "${result.translation.content}"`
            )
            modifiedTranslationKeys.push(result.key)
        }
    }

    for (const [name] of Object.entries(translationsDiff.deleted)) {
        console.log(`Deleting translation key ${name}`)

        await deleteTranslationKey(name)

        console.log(`Translation key ${name} was deleted`)
    }

    if (userInput.phraseJob === UserAction.CREATE_NEW) {
        console.log('Creating a phrase job')
        const dueDateNumber = userInput.jobDueDateNumber
            ? parseInt(userInput.jobDueDateNumber, 10)
            : 7
        const dueDate = addDays(new Date(), dueDateNumber)

        const job = await createPhraseJob({
            name: `[${userInput.jiraTicketId}] ${userInput.jobName}`,
            briefing: userInput.jobDescription || '',
            ticketUrl: `https://deeploi.atlassian.net/browse/${userInput.jiraTicketId}`,
            dueDate,
            translationKeyIds: modifiedTranslationKeys
                .filter((translation) => translation.id)
                .map((translation) => translation.id) as string[],
        })

        console.log(
            `Job was successfully created https://app.phrase.com/accounts/deeploi/projects/${phraseProjectName}/jobs/${job.id}`
        )
        console.log(
            'Attach screen-shots for each translation and "start" a job manually from the Phrase UI when you are ready'
        )
    } else if (userInput.phraseJob === UserAction.DO_NOT_CREATE) {
        console.log('Phrase job was not created')
    } else if (userInput.phraseJob) {
        const job = await updatePhraseJob({
            jobId: userInput.phraseJob,
            translationKeyIds: modifiedTranslationKeys
                .filter((translation) => translation.id)
                .map((translation) => translation.id) as string[],
        })

        console.log(
            `Job was successfully updated https://app.phrase.com/accounts/deeploi/projects/${phraseProjectName}/jobs/${job.id}`
        )
    }

    await clearTmpDir()
}

export default push
