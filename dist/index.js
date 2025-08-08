"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  pull: () => pull_default,
  push: () => push_default
});
module.exports = __toCommonJS(src_exports);

// src/fileUtils.ts
var import_node_fs = __toESM(require("fs"));

// src/config.ts
var import_node_path = __toESM(require("path"));
var import_node_os = __toESM(require("os"));
var import_node_process = __toESM(require("process"));
var supportedLocales = ["en", "de"];
var tempDirPath = import_node_path.default.join(import_node_os.default.tmpdir(), "web-app-phrase");
var phraseApiToken = import_node_process.default.env.PHRASE_API_TOKEN;

// src/fileUtils.ts
var prepareTmpDir = () => {
  if (import_node_fs.default.existsSync(tempDirPath)) {
    clearTmpDir();
  }
  import_node_fs.default.mkdirSync(tempDirPath);
};
var clearTmpDir = () => {
  import_node_fs.default.rmSync(tempDirPath, { recursive: true, force: true });
};

// src/lib.ts
var import_node_fs2 = __toESM(require("fs"));
var import_node_path2 = __toESM(require("path"));
var import_differenceInMilliseconds = require("date-fns/differenceInMilliseconds");
var import_phrase_js = require("phrase-js");
var import_form_data = __toESM(require("form-data"));
var import_node_process2 = __toESM(require("process"));
var import_deep_object_diff = require("deep-object-diff");
var import_dot_object = require("dot-object");
var import_prompts = require("@inquirer/prompts");
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
        const waitInMs = (0, import_differenceInMilliseconds.differenceInMilliseconds)(rateLimitResetMs, /* @__PURE__ */ new Date());
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
globalAny.FormData = import_form_data.default;
var configuration = new import_phrase_js.Configuration({
  apiKey: `token ${phraseApiToken}`,
  fetchApi: fetch
});
var localesApi = new import_phrase_js.LocalesApi(configuration);
var jobsApi = new import_phrase_js.JobsApi(configuration);
var keysApi = new import_phrase_js.KeysApi(configuration);
var translationsApi = new import_phrase_js.TranslationsApi(configuration);
var jobLocalesApi = new import_phrase_js.JobLocalesApi(configuration);
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
  await import_node_fs2.default.promises.writeFile(import_node_path2.default.join(tempDirPath, `${locale}.json`), buffer);
  return require(import_node_path2.default.join(tempDirPath, `${locale}.json`));
};
var createLocaleFiles = async ({
  locale,
  localesDirPath
}) => {
  const localeJsonObject = require(import_node_path2.default.join(tempDirPath, `${locale}.json`));
  const namespaces = Object.keys(localeJsonObject);
  await Promise.all(
    namespaces.map((namespace) => {
      return import_node_fs2.default.writeFileSync(
        import_node_path2.default.join(localesDirPath, locale, `${namespace}.json`),
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
  const files = await import_node_fs2.default.promises.readdir(import_node_path2.default.join(localesDirPath, locale));
  await Promise.all(
    files.map(async (fileName) => {
      const localeNamespaceFile = require(import_node_path2.default.join(localesDirPath, locale, fileName));
      const namespace = fileName.replace(".json", "");
      localeFileObj[namespace] = localeNamespaceFile;
    })
  );
  return localeFileObj;
};
var findModifiedTranslationKeys = async (phraseFileObj, localeFileObj) => {
  const { default: chalk } = await import("chalk");
  const phraseFileObjDot = (0, import_dot_object.dot)(phraseFileObj);
  const localeFileObjDot = (0, import_dot_object.dot)(localeFileObj);
  const added = (0, import_dot_object.dot)((0, import_deep_object_diff.addedDiff)(phraseFileObjDot, localeFileObjDot));
  const updated = (0, import_dot_object.dot)((0, import_deep_object_diff.updatedDiff)(phraseFileObjDot, localeFileObjDot));
  const deleted = (0, import_dot_object.dot)((0, import_deep_object_diff.deletedDiff)(phraseFileObjDot, localeFileObjDot));
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
  const answer = await (0, import_prompts.confirm)({ message: "Push new translations to Phrase?" });
  let jiraTicketId = void 0;
  let jobName = void 0;
  let jobDescription = void 0;
  let jobDueDateNumber = void 0;
  if (!answer) {
    import_node_process2.default.exit(0);
  }
  const phraseJob = await (0, import_prompts.select)({
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
    jiraTicketId = await (0, import_prompts.input)({ message: "Jira ticket ID", default: "IT-", required: true });
    jobName = await (0, import_prompts.input)({ message: "Job name", required: true });
    jobDescription = await (0, import_prompts.input)({ message: "Job description", required: true });
    jobDueDateNumber = await (0, import_prompts.input)({
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
var import_date_fns = require("date-fns");
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
    const dueDate = (0, import_date_fns.addDays)(/* @__PURE__ */ new Date(), dueDateNumber);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  pull,
  push
});
