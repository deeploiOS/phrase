import fs from 'node:fs'
import path from 'node:path'
import { differenceInMilliseconds } from 'date-fns/differenceInMilliseconds'

import { tempDirPath, phraseApiToken } from './config'
import {
    Configuration,
    LocalesApi,
    JobsApi,
    Job,
    KeysApi,
    TranslationsApi,
    JobLocalesApi,
} from 'phrase-js'

import FormData from 'form-data'
import process from 'node:process'

import { addedDiff, updatedDiff, deletedDiff } from 'deep-object-diff'
import { dot } from 'dot-object'
import { confirm, input, select } from '@inquirer/prompts'

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

const assertIsResponse = (e: unknown): Response => {
    if (e !== null && typeof e === 'object' && 'status' in e && 'headers' in e) {
        return e as Response
    }

    throw e as Error
}

const callApiFunction = async <T, P>(apiCall: (params: P) => Promise<T>, params: P) => {
    try {
        return await apiCall(params)
    } catch (e: unknown) {
        const response = assertIsResponse(e)

        // Too many request, we reached api rate limit
        if (response.status === 429) {
            const xRateLimitReset = response.headers.get('x-rate-limit-reset')

            if (xRateLimitReset) {
                const rateLimitResetMs = parseInt(xRateLimitReset, 10) * 1000

                const waitInMs = differenceInMilliseconds(rateLimitResetMs, new Date())

                console.log(`api rate limit reached, waiting ${waitInMs}ms`)
                await sleep(waitInMs)
                return await callApiFunction(apiCall, params)
            } else {
                throw e
            }
        } else {
            throw e
        }
    }
}

// eslint-disable-next-line
const globalAny: any = globalThis
globalAny.FormData = FormData

export enum UserAction {
    DO_NOT_CREATE = 'DO_NOT_CREATE',
    CREATE_NEW = 'CREATE_NEW',
}

const configuration = new Configuration({
    apiKey: `token ${phraseApiToken}`,
    fetchApi: fetch,
})

const localesApi = new LocalesApi(configuration)
const jobsApi = new JobsApi(configuration)
const keysApi = new KeysApi(configuration)
const translationsApi = new TranslationsApi(configuration)
const jobLocalesApi = new JobLocalesApi(configuration)

let phraseProjectId: string

const setPhraseProjectId = (projectId: string) => {
    phraseProjectId = projectId
}

const downloadLocale = async (locale: string, skipUnverifiedTranslations = true) => {
    const blob = await callApiFunction(async () => {
        return await localesApi.localeDownload({
            projectId: phraseProjectId,
            id: locale,
            fileFormat: 'i18next',
            skipUnverifiedTranslations,
        })
    }, [])

    const buffer = Buffer.from(await blob.arrayBuffer())

    await fs.promises.writeFile(path.join(tempDirPath, `${locale}.json`), buffer)

    return require(path.join(tempDirPath, `${locale}.json`))
}

const createLocaleFiles = async ({
    locale,
    localesDirPath,
}: {
    localesDirPath: string
    locale: string
}) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const localeJsonObject = require(path.join(tempDirPath, `${locale}.json`))

    const namespaces = Object.keys(localeJsonObject)

    await Promise.all(
        namespaces.map((namespace) => {
            return fs.writeFileSync(
                path.join(localesDirPath, locale, `${namespace}.json`),
                JSON.stringify(localeJsonObject[namespace], null, 4)
            )
        })
    )
}

const getJobs = async () => {
    const draftJobs = await callApiFunction(async () => {
        return jobsApi.jobsList({
            projectId: phraseProjectId,
            perPage: 100,
            state: 'draft',
        })
    }, [])

    const inProgressJobs = await callApiFunction(async () => {
        return await jobsApi.jobsList({
            projectId: phraseProjectId,
            perPage: 100,
            state: 'in_progress',
        })
    }, [])

    return [...draftJobs, ...inProgressJobs]
}

const composeLocalLocaleFile = async ({
    locale,
    localesDirPath,
}: {
    locale: string
    localesDirPath: string
}) => {
    const localeFileObj: Record<string, unknown> = {}
    const files = await fs.promises.readdir(path.join(localesDirPath, locale))

    await Promise.all(
        files.map(async (fileName) => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const localeNamespaceFile = require(path.join(localesDirPath, locale, fileName))
            const namespace = fileName.replace('.json', '')

            localeFileObj[namespace] = localeNamespaceFile
        })
    )

    return localeFileObj
}

const findModifiedTranslationKeys = async (
    phraseFileObj: Record<string, unknown>,
    localeFileObj: Record<string, unknown>
) => {
    const { default: chalk } = await import('chalk')

    const phraseFileObjDot = dot(phraseFileObj)
    const localeFileObjDot = dot(localeFileObj)

    const added = dot(addedDiff(phraseFileObjDot, localeFileObjDot))
    const updated = dot(updatedDiff(phraseFileObjDot, localeFileObjDot))
    const deleted = dot(deletedDiff(phraseFileObjDot, localeFileObjDot))

    const addedKeys = Object.keys(added)
    const updatedKeys = Object.keys(updated)
    const deletedKeys = Object.keys(deleted)

    addedKeys.forEach((key) => {
        console.log(chalk.green(key), added[key])
    })
    updatedKeys.forEach((key) => {
        console.log(chalk.yellow(key), updated[key])
    })
    deletedKeys.forEach((key) => {
        console.log(chalk.red(key))
    })

    console.log('-------------------------')
    console.log(
        `Added: ${addedKeys.length}, updated: ${updatedKeys.length}, deleted: ${deletedKeys.length}`
    )

    return {
        added,
        updated,
        deleted,
    }
}

const initiateUserDialog = async ({ jobs }: { jobs: Job[] }) => {
    // It's needed to show user props after console.log of modified translations
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log('-----------------')
    const answer = await confirm({ message: 'Push new translations to Phrase?' })
    let jiraTicketId: string | undefined = undefined
    let jobName: string | undefined = undefined
    let jobDescription: string | undefined = undefined
    let jobDueDateNumber: string | undefined = undefined

    if (!answer) {
        process.exit(0)
    }

    const phraseJob = await select({
        message: 'Select a phrase job to update',
        choices: [
            {
                value: UserAction.DO_NOT_CREATE,
                name: 'Do not create',
            },
            {
                value: UserAction.CREATE_NEW,
                name: 'Create new',
            },
            ...jobs.map((job) => ({
                value: job.id,
                name: `Add to [${job.state}] ${job.name}`,
            })),
        ],
    })

    if (phraseJob === UserAction.CREATE_NEW) {
        jiraTicketId = await input({ message: 'Jira ticket ID', default: 'IT-', required: true })
        jobName = await input({ message: 'Job name', required: true })
        jobDescription = await input({ message: 'Job description', required: true })
        jobDueDateNumber = await input({
            message: 'In how many days it should be translated?',
            default: '7',
            required: true,
        })
    }

    return {
        phraseJob,
        jiraTicketId,
        jobName,
        jobDescription,
        jobDueDateNumber,
    }
}

const getKeyByName = async (name: string) => {
    const keys = await callApiFunction(async () => {
        return await keysApi.keysSearch({
            projectId: phraseProjectId,
            keysSearchParameters: {
                q: `name:${name}`,
            },
        })
    }, [])

    if (keys.length === 1) {
        return keys[0]
    }
}

const deleteTranslationKey = async (name: string) => {
    const key = await getKeyByName(name)

    if (key?.id) {
        return await callApiFunction(
            async ([keyId]) => {
                return await keysApi.keyDelete({
                    projectId: phraseProjectId,
                    id: keyId,
                })
            },
            [key.id]
        )
    }
}

const getEnTranslationForKeyByKeyId = async (keyId: string) => {
    const translations = await callApiFunction(async () => {
        return await translationsApi.translationsByKey({
            projectId: phraseProjectId,
            keyId,
        })
    }, [])

    const enTranslations = translations.filter((translation) => translation.locale?.code === 'en')

    if (enTranslations.length === 1) {
        return enTranslations[0]
    }
}

const getTranslationByKeyName = async (name: string) => {
    const key = await getKeyByName(name)

    if (key?.id) {
        const translation = await getEnTranslationForKeyByKeyId(key.id)

        return {
            translation,
            key,
        }
    }
}

const updateTranslationKey = async ({ name, value }: { name: string; value: string }) => {
    const result = await getTranslationByKeyName(name)

    if (result?.translation?.id) {
        const updatedTranslation = await callApiFunction(
            async ([translationId]) => {
                return await translationsApi.translationUpdate({
                    projectId: phraseProjectId,
                    id: translationId,
                    translationUpdateParameters: {
                        content: value,
                    },
                })
            },
            [result.translation.id]
        )

        return {
            key: result?.key,
            translation: updatedTranslation,
        }
    }
}

const createTranslationKey = async ({ name, value }: { name: string; value: string }) => {
    const key = await callApiFunction(async () => {
        return await keysApi.keyCreate({
            projectId: phraseProjectId,
            keyCreateParameters: {
                name,
                defaultTranslationContent: value,
            },
        })
    }, [])

    if (key.id) {
        const translation = await callApiFunction(
            async ([keyId]) => {
                return await getEnTranslationForKeyByKeyId(keyId)
            },
            [key.id]
        )

        return {
            key,
            translation,
        }
    }
}

const createPhraseJob = async ({
    name,
    briefing,
    dueDate,
    ticketUrl,
    translationKeyIds,
}: {
    name: string
    briefing: string
    dueDate: Date
    ticketUrl: string
    translationKeyIds: string[]
}) => {
    const job = await callApiFunction(async () => {
        return await jobsApi.jobCreate({
            projectId: phraseProjectId,
            jobCreateParameters: {
                name,
                briefing,
                dueDate,
                ticketUrl,
                translationKeyIds,
            },
        })
    }, [])

    if (job.id) {
        const locales = await callApiFunction(async () => {
            return await localesApi.localesList({
                projectId: phraseProjectId,
            })
        }, [])

        const deLocale = locales.filter(({ code }) => code === 'de')

        if (deLocale.length === 1 && deLocale[0].id) {
            await callApiFunction(
                async ([jobId, deLocaleId]) => {
                    await jobLocalesApi.jobLocalesCreate({
                        projectId: phraseProjectId,
                        jobId: jobId,
                        jobLocalesCreateParameters: {
                            localeId: deLocaleId,
                        },
                    })
                },
                [job.id, deLocale[0].id]
            )
        }
    }

    return job
}

const updatePhraseJob = async ({
    jobId,
    translationKeyIds,
}: {
    jobId: string
    translationKeyIds: string[]
}) => {
    return callApiFunction(async () => {
        return await jobsApi.jobKeysCreate({
            projectId: phraseProjectId,
            id: jobId,
            jobKeysCreateParameters: {
                translationKeyIds,
            },
        })
    }, [])
}

export {
    setPhraseProjectId,
    downloadLocale,
    createLocaleFiles,
    getJobs,
    composeLocalLocaleFile,
    findModifiedTranslationKeys,
    initiateUserDialog,
    deleteTranslationKey,
    createTranslationKey,
    updateTranslationKey,
    createPhraseJob,
    updatePhraseJob,
}
