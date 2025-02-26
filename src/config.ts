import path from 'node:path'
import os from 'node:os'
import process from 'node:process'

const supportedLocales = ['en', 'de']
const tempDirPath = path.join(os.tmpdir(), 'web-app-phrase')
const phraseApiToken = process.env.PHRASE_API_TOKEN

export { supportedLocales, tempDirPath, phraseApiToken }
