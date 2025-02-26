import fs from 'node:fs'
import { tempDirPath } from './config'

const prepareTmpDir = () => {
    if (fs.existsSync(tempDirPath)) {
        clearTmpDir()
    }

    fs.mkdirSync(tempDirPath)
}

const clearTmpDir = () => {
    fs.rmSync(tempDirPath, { recursive: true, force: true })
}

export { prepareTmpDir, clearTmpDir }
