var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined")
    return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/fileUtils.ts
import fs from "node:fs";

// src/config.ts
import path from "node:path";
import os from "node:os";
import process2 from "node:process";
var supportedLocales = ["en", "de"];
var tempDirPath = path.join(os.tmpdir(), "web-app-phrase");
var phraseApiToken = process2.env.PHRASE_API_TOKEN;

// src/fileUtils.ts
var prepareTmpDir = () => {
  if (fs.existsSync(tempDirPath)) {
    clearTmpDir();
  }
  fs.mkdirSync(tempDirPath);
};
var clearTmpDir = () => {
  fs.rmSync(tempDirPath, { recursive: true, force: true });
};

// src/lib.ts
import fs2 from "node:fs";
import path2 from "node:path";
import { differenceInMilliseconds } from "date-fns/differenceInMilliseconds";
import {
  Configuration,
  LocalesApi,
  JobsApi,
  KeysApi,
  TranslationsApi,
  JobLocalesApi
} from "phrase-js";
import FormData from "form-data";
import process3 from "node:process";
import { addedDiff, updatedDiff, deletedDiff } from "deep-object-diff";
import { dot } from "dot-object";
import { confirm, input, select } from "@inquirer/prompts";
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
var assertIsResponse = (e) => {
  if (e !== null && typeof e === "object" && "status" in e && "headers" in e) {
    return e;
  }
  throw e;
};
var callApiFunction = async (apiCall, params) => {
  try {
    return await apiCall(params);
  } catch (e) {
    const response = assertIsResponse(e);
    if (response.status === 429) {
      const xRateLimitReset = response.headers.get("x-rate-limit-reset");
      if (xRateLimitReset) {
        const rateLimitResetMs = parseInt(xRateLimitReset, 10) * 1e3;
        const waitInMs = differenceInMilliseconds(rateLimitResetMs, /* @__PURE__ */ new Date());
        console.log(`api rate limit reached, waiting ${waitInMs}ms`);
        await sleep(waitInMs);
        return await callApiFunction(apiCall, params);
      } else {
        throw e;
      }
    } else {
      throw e;
    }
  }
};
var globalAny = globalThis;
globalAny.FormData = FormData;
var configuration = new Configuration({
  apiKey: `token ${phraseApiToken}`,
  fetchApi: fetch
});
var localesApi = new LocalesApi(configuration);
var jobsApi = new JobsApi(configuration);
var keysApi = new KeysApi(configuration);
var translationsApi = new TranslationsApi(configuration);
var jobLocalesApi = new JobLocalesApi(configuration);
var phraseProjectId;
var setPhraseProjectId = (projectId) => {
  phraseProjectId = projectId;
};
var downloadLocale = async (locale, skipUnverifiedTranslations = true) => {
  const blob = await callApiFunction(async () => {
    return await localesApi.localeDownload({
      projectId: phraseProjectId,
      id: locale,
      fileFormat: "i18next",
      skipUnverifiedTranslations
    });
  }, []);
  const buffer = Buffer.from(await blob.arrayBuffer());
  await fs2.promises.writeFile(path2.join(tempDirPath, `${locale}.json`), buffer);
  return __require(path2.join(tempDirPath, `${locale}.json`));
};
var createLocaleFiles = async ({
  locale,
  localesDirPath
}) => {
  const localeJsonObject = __require(path2.join(tempDirPath, `${locale}.json`));
  const namespaces = Object.keys(localeJsonObject);
  await Promise.all(
    namespaces.map((namespace) => {
      return fs2.writeFileSync(
        path2.join(localesDirPath, locale, `${namespace}.json`),
        JSON.stringify(localeJsonObject[namespace], null, 4)
      );
    })
  );
};
var getJobs = async () => {
  const draftJobs = await callApiFunction(async () => {
    return jobsApi.jobsList({
      projectId: phraseProjectId,
      perPage: 100,
      state: "draft"
    });
  }, []);
  const inProgressJobs = await callApiFunction(async () => {
    return await jobsApi.jobsList({
      projectId: phraseProjectId,
      perPage: 100,
      state: "in_progress"
    });
  }, []);
  return [...draftJobs, ...inProgressJobs];
};
var composeLocalLocaleFile = async ({
  locale,
  localesDirPath
}) => {
  const localeFileObj = {};
  const files = await fs2.promises.readdir(path2.join(localesDirPath, locale));
  await Promise.all(
    files.map(async (fileName) => {
      const localeNamespaceFile = __require(path2.join(localesDirPath, locale, fileName));
      const namespace = fileName.replace(".json", "");
      localeFileObj[namespace] = localeNamespaceFile;
    })
  );
  return localeFileObj;
};
var findModifiedTranslationKeys = async (phraseFileObj, localeFileObj) => {
  const { default: chalk } = await import("chalk");
  const phraseFileObjDot = dot(phraseFileObj);
  const localeFileObjDot = dot(localeFileObj);
  const added = dot(addedDiff(phraseFileObjDot, localeFileObjDot));
  const updated = dot(updatedDiff(phraseFileObjDot, localeFileObjDot));
  const deleted = dot(deletedDiff(phraseFileObjDot, localeFileObjDot));
  const addedKeys = Object.keys(added);
  const updatedKeys = Object.keys(updated);
  const deletedKeys = Object.keys(deleted);
  addedKeys.forEach((key) => {
    console.log(chalk.green(key), added[key]);
  });
  updatedKeys.forEach((key) => {
    console.log(chalk.yellow(key), updated[key]);
  });
  deletedKeys.forEach((key) => {
    console.log(chalk.red(key));
  });
  console.log("-------------------------");
  console.log(
    `Added: ${addedKeys.length}, updated: ${updatedKeys.length}, deleted: ${deletedKeys.length}`
  );
  return {
    added,
    updated,
    deleted
  };
};
var initiateUserDialog = async ({ jobs }) => {
  await new Promise((resolve) => setTimeout(resolve, 1e3));
  console.log("-----------------");
  const answer = await confirm({ message: "Push new translations to Phrase?" });
  let jiraTicketId = void 0;
  let jobName = void 0;
  let jobDescription = void 0;
  let jobDueDateNumber = void 0;
  if (!answer) {
    process3.exit(0);
  }
  const phraseJob = await select({
    message: "Select a phrase job to update",
    choices: [
      {
        value: "DO_NOT_CREATE" /* DO_NOT_CREATE */,
        name: "Do not create"
      },
      {
        value: "CREATE_NEW" /* CREATE_NEW */,
        name: "Create new"
      },
      ...jobs.map((job) => ({
        value: job.id,
        name: `Add to [${job.state}] ${job.name}`
      }))
    ]
  });
  if (phraseJob === "CREATE_NEW" /* CREATE_NEW */) {
    jiraTicketId = await input({ message: "Jira ticket ID", default: "IT-", required: true });
    jobName = await input({ message: "Job name", required: true });
    jobDescription = await input({ message: "Job description", required: true });
    jobDueDateNumber = await input({
      message: "In how many days it should be translated?",
      default: "7",
      required: true
    });
  }
  return {
    phraseJob,
    jiraTicketId,
    jobName,
    jobDescription,
    jobDueDateNumber
  };
};
var getKeyByName = async (name) => {
  const keys = await callApiFunction(async () => {
    return await keysApi.keysSearch({
      projectId: phraseProjectId,
      keysSearchParameters: {
        q: `name:${name}`
      }
    });
  }, []);
  if (keys.length === 1) {
    return keys[0];
  }
};
var deleteTranslationKey = async (name) => {
  const key = await getKeyByName(name);
  if (key == null ? void 0 : key.id) {
    return await callApiFunction(
      async ([keyId]) => {
        return await keysApi.keyDelete({
          projectId: phraseProjectId,
          id: keyId
        });
      },
      [key.id]
    );
  }
};
var getEnTranslationForKeyByKeyId = async (keyId) => {
  const translations = await callApiFunction(async () => {
    return await translationsApi.translationsByKey({
      projectId: phraseProjectId,
      keyId
    });
  }, []);
  const enTranslations = translations.filter((translation) => {
    var _a;
    return ((_a = translation.locale) == null ? void 0 : _a.code) === "en";
  });
  if (enTranslations.length === 1) {
    return enTranslations[0];
  }
};
var getTranslationByKeyName = async (name) => {
  const key = await getKeyByName(name);
  if (key == null ? void 0 : key.id) {
    const translation = await getEnTranslationForKeyByKeyId(key.id);
    return {
      translation,
      key
    };
  }
};
var updateTranslationKey = async ({ name, value }) => {
  var _a;
  const result = await getTranslationByKeyName(name);
  if ((_a = result == null ? void 0 : result.translation) == null ? void 0 : _a.id) {
    const updatedTranslation = await callApiFunction(
      async ([translationId]) => {
        return await translationsApi.translationUpdate({
          projectId: phraseProjectId,
          id: translationId,
          translationUpdateParameters: {
            content: value
          }
        });
      },
      [result.translation.id]
    );
    return {
      key: result == null ? void 0 : result.key,
      translation: updatedTranslation
    };
  }
};
var createTranslationKey = async ({ name, value }) => {
  const key = await callApiFunction(async () => {
    return await keysApi.keyCreate({
      projectId: phraseProjectId,
      keyCreateParameters: {
        name,
        defaultTranslationContent: value
      }
    });
  }, []);
  if (key.id) {
    const translation = await callApiFunction(
      async ([keyId]) => {
        return await getEnTranslationForKeyByKeyId(keyId);
      },
      [key.id]
    );
    return {
      key,
      translation
    };
  }
};
var createPhraseJob = async ({
  name,
  briefing,
  dueDate,
  ticketUrl,
  translationKeyIds
}) => {
  const job = await callApiFunction(async () => {
    return await jobsApi.jobCreate({
      projectId: phraseProjectId,
      jobCreateParameters: {
        name,
        briefing,
        dueDate,
        ticketUrl,
        translationKeyIds
      }
    });
  }, []);
  if (job.id) {
    const locales = await callApiFunction(async () => {
      return await localesApi.localesList({
        projectId: phraseProjectId
      });
    }, []);
    const deLocale = locales.filter(({ code }) => code === "de");
    if (deLocale.length === 1 && deLocale[0].id) {
      await callApiFunction(
        async ([jobId, deLocaleId]) => {
          await jobLocalesApi.jobLocalesCreate({
            projectId: phraseProjectId,
            jobId,
            jobLocalesCreateParameters: {
              localeId: deLocaleId
            }
          });
        },
        [job.id, deLocale[0].id]
      );
    }
  }
  return job;
};
var updatePhraseJob = async ({
  jobId,
  translationKeyIds
}) => {
  return callApiFunction(async () => {
    return await jobsApi.jobKeysCreate({
      projectId: phraseProjectId,
      id: jobId,
      jobKeysCreateParameters: {
        translationKeyIds
      }
    });
  }, []);
};

// src/pull.ts
var pull = async ({
  localesDirPath,
  phraseProjectId: phraseProjectId2
}) => {
  setPhraseProjectId(phraseProjectId2);
  prepareTmpDir();
  await Promise.all(supportedLocales.map((locale) => downloadLocale(locale)));
  await Promise.all(
    supportedLocales.map(
      (locale) => createLocaleFiles({
        locale,
        localesDirPath
      })
    )
  );
  clearTmpDir();
  console.log("Phrase translations are pulled");
};
var pull_default = pull;

// src/push.ts
import { addDays } from "date-fns";
var modifiedTranslationKeys = [];
var push = async ({
  phraseProjectName,
  phraseProjectId: phraseProjectId2,
  localesDirPath
}) => {
  var _a, _b;
  setPhraseProjectId(phraseProjectId2);
  prepareTmpDir();
  const phraseObj = await downloadLocale("en", false);
  const localObj = await composeLocalLocaleFile({
    locale: "en",
    localesDirPath
  });
  const jobs = await getJobs();
  const translationsDiff = await findModifiedTranslationKeys(phraseObj, localObj);
  if (Object.keys(translationsDiff.added).length + Object.keys(translationsDiff.updated).length + Object.keys(translationsDiff.deleted).length === 0) {
    console.log("Nothing to push");
    process.exit(0);
  }
  const userInput = await initiateUserDialog({ jobs });
  for (const [name, value] of Object.entries(translationsDiff.added)) {
    console.log(`Creating translation key ${name} ${value}`);
    const result = await createTranslationKey({
      name,
      value
    });
    if (result) {
      console.log(
        `Translation key ${result.key.id} was created. En translation id ${(_a = result.translation) == null ? void 0 : _a.id} "${(_b = result.translation) == null ? void 0 : _b.content}"`
      );
      if (result.key) {
        modifiedTranslationKeys.push(result.key);
      }
    }
  }
  for (const [name, value] of Object.entries(translationsDiff.updated)) {
    console.log(`Updating translation key ${name} ${value}`);
    const result = await updateTranslationKey({
      name,
      value
    });
    if ((result == null ? void 0 : result.translation) && (result == null ? void 0 : result.key)) {
      console.log(
        `Translation key ${result.translation.id} was updated to "${result.translation.content}"`
      );
      modifiedTranslationKeys.push(result.key);
    }
  }
  for (const [name] of Object.entries(translationsDiff.deleted)) {
    console.log(`Deleting translation key ${name}`);
    await deleteTranslationKey(name);
    console.log(`Translation key ${name} was deleted`);
  }
  if (userInput.phraseJob === "CREATE_NEW" /* CREATE_NEW */) {
    console.log("Creating a phrase job");
    const dueDateNumber = userInput.jobDueDateNumber ? parseInt(userInput.jobDueDateNumber, 10) : 7;
    const dueDate = addDays(/* @__PURE__ */ new Date(), dueDateNumber);
    const job = await createPhraseJob({
      name: `[${userInput.jiraTicketId}] ${userInput.jobName}`,
      briefing: userInput.jobDescription || "",
      ticketUrl: `https://deeploi.atlassian.net/browse/${userInput.jiraTicketId}`,
      dueDate,
      translationKeyIds: modifiedTranslationKeys.filter((translation) => translation.id).map((translation) => translation.id)
    });
    console.log(
      `Job was successfully created https://app.phrase.com/accounts/deeploi/projects/${phraseProjectName}/jobs/${job.id}`
    );
    console.log(
      'Attach screen-shots for each translation and "start" a job manually from the Phrase UI when you are ready'
    );
  } else if (userInput.phraseJob === "DO_NOT_CREATE" /* DO_NOT_CREATE */) {
    console.log("Phrase job was not created");
  } else if (userInput.phraseJob) {
    const job = await updatePhraseJob({
      jobId: userInput.phraseJob,
      translationKeyIds: modifiedTranslationKeys.filter((translation) => translation.id).map((translation) => translation.id)
    });
    console.log(
      `Job was successfully updated https://app.phrase.com/accounts/deeploi/projects/${phraseProjectName}/jobs/${job.id}`
    );
  }
  await clearTmpDir();
};
var push_default = push;
export {
  pull_default as pull,
  push_default as push
};
