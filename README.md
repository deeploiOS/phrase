# phrase
NodeJS scripts to push and pull translations from phrase

### Installation

```bash
yarn add --dev @deeploiOS/phrase@https://github.com/deeploiOS/phrase #you can add specific tag/branch/etc.
```

### Example usage to pull translations

```javascript
// pull.mjs
import { pull } from '@deeploiOS/phrase'
import path from 'node:path'

const localesDirPath = path.join(path.resolve(), 'public', 'locales')

pull({
    localesDirPath,
    phraseProjectId: 'phrase project id',
})
```

### Example usage to push translations

```javascript
// push.mjs
import { push } from '@deeploiOS/phrase'
import path from 'node:path'

const localesDirPath = path.join(path.resolve(), 'public', 'locales')

push({
    phraseProjectName: 'web-app',
    phraseProjectId: 'phrase project id',
    localesDirPath,
}).catch((e) => {
    console.log('Phrase push failed')
    console.error(e)
})

```
