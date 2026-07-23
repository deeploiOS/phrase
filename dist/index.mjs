import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import process$1 from "node:process";
import { differenceInMilliseconds } from "date-fns/differenceInMilliseconds";
import { Configuration, JobLocalesApi, JobsApi, KeysApi, LocalesApi, TranslationsApi } from "phrase-js";
import FormData from "form-data";
import { addedDiff, deletedDiff, updatedDiff } from "deep-object-diff";
import { dot } from "dot-object";
import { confirm, input, select } from "@inquirer/prompts";
import { addDays } from "date-fns";
//#region \0rolldown/runtime.js
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
//#endregion
//#region src/config.ts
const supportedLocales = ["en", "de"];
const tempDirPath = path.join(os.tmpdir(), "web-app-phrase");
const phraseApiToken = process$1.env.PHRASE_API_TOKEN;
//#endregion
//#region src/fileUtils.ts
const prepareTmpDir = () => {
	if (fs.existsSync(tempDirPath)) clearTmpDir();
	fs.mkdirSync(tempDirPath);
};
const clearTmpDir = () => {
	fs.rmSync(tempDirPath, {
		recursive: true,
		force: true
	});
};
//#endregion
//#region src/lib.ts
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
const assertIsResponse = (e) => {
	if (e !== null && typeof e === "object" && "status" in e && "headers" in e) return e;
	throw e;
};
const callApiFunction = async (apiCall, params) => {
	try {
		return await apiCall(params);
	} catch (e) {
		const response = assertIsResponse(e);
		if (response.status === 429) {
			const xRateLimitReset = response.headers.get("x-rate-limit-reset");
			if (xRateLimitReset) {
				const waitInMs = differenceInMilliseconds(parseInt(xRateLimitReset, 10) * 1e3, /* @__PURE__ */ new Date());
				console.log(`api rate limit reached, waiting ${waitInMs}ms`);
				await sleep(waitInMs);
				return await callApiFunction(apiCall, params);
			} else throw e;
		} else throw e;
	}
};
const globalAny = globalThis;
globalAny.FormData = FormData;
const configuration = new Configuration({
	apiKey: `token ${phraseApiToken}`,
	fetchApi: fetch
});
const localesApi = new LocalesApi(configuration);
const jobsApi = new JobsApi(configuration);
const keysApi = new KeysApi(configuration);
const translationsApi = new TranslationsApi(configuration);
const jobLocalesApi = new JobLocalesApi(configuration);
let phraseProjectId;
const setPhraseProjectId = (projectId) => {
	phraseProjectId = projectId;
};
const downloadLocale = async (locale, skipUnverifiedTranslations = true) => {
	const blob = await callApiFunction(async () => {
		return await localesApi.localeDownload({
			projectId: phraseProjectId,
			id: locale,
			fileFormat: "i18next",
			skipUnverifiedTranslations
		});
	}, []);
	const buffer = Buffer.from(await blob.arrayBuffer());
	await fs.promises.writeFile(path.join(tempDirPath, `${locale}.json`), buffer);
	return __require(path.join(tempDirPath, `${locale}.json`));
};
const createLocaleFiles = async ({ locale, localesDirPath, preserveLocalKeys = true }) => {
	const localeJsonObject = JSON.parse(fs.readFileSync(path.join(tempDirPath, `${locale}.json`), "utf-8"));
	const namespaces = Object.keys(localeJsonObject);
	await Promise.all(namespaces.map((namespace) => {
		let content = localeJsonObject[namespace];
		if (preserveLocalKeys) {
			const localFilePath = path.join(localesDirPath, locale, `${namespace}.json`);
			if (fs.existsSync(localFilePath)) content = {
				...JSON.parse(fs.readFileSync(localFilePath, "utf-8")),
				...content
			};
		}
		return fs.writeFileSync(path.join(localesDirPath, locale, `${namespace}.json`), JSON.stringify(content, null, 4) + "\n");
	}));
};
const getJobs = async () => {
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
const composeLocalLocaleFile = async ({ locale, localesDirPath }) => {
	const localeFileObj = {};
	const files = await fs.promises.readdir(path.join(localesDirPath, locale));
	await Promise.all(files.map(async (fileName) => {
		const localeNamespaceFile = __require(path.join(localesDirPath, locale, fileName));
		const namespace = fileName.replace(".json", "");
		localeFileObj[namespace] = localeNamespaceFile;
	}));
	return localeFileObj;
};
const findModifiedTranslationKeys = async (phraseFileObj, localeFileObj) => {
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
	console.log(`Added: ${addedKeys.length}, updated: ${updatedKeys.length}, deleted: ${deletedKeys.length}`);
	return {
		added,
		updated,
		deleted
	};
};
const initiateUserDialog = async ({ jobs }) => {
	await new Promise((resolve) => setTimeout(resolve, 1e3));
	console.log("-----------------");
	const answer = await confirm({ message: "Push new translations to Phrase?" });
	let jiraTicketId = void 0;
	let jobName = void 0;
	let jobDescription = void 0;
	let jobDueDateNumber = void 0;
	if (!answer) process$1.exit(0);
	const phraseJob = await select({
		message: "Select a phrase job to update",
		choices: [
			{
				value: "DO_NOT_CREATE",
				name: "Do not create"
			},
			{
				value: "CREATE_NEW",
				name: "Create new"
			},
			...jobs.map((job) => ({
				value: job.id,
				name: `Add to [${job.state}] ${job.name}`
			}))
		]
	});
	if (phraseJob === "CREATE_NEW") {
		jiraTicketId = await input({
			message: "Jira ticket ID",
			default: "IT-",
			required: true
		});
		jobName = await input({
			message: "Job name",
			required: true
		});
		jobDescription = await input({
			message: "Job description",
			required: true
		});
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
const getKeyByName = async (name) => {
	const keys = await callApiFunction(async () => {
		return await keysApi.keysSearch({
			projectId: phraseProjectId,
			keysSearchParameters: { q: `name:${name}` }
		});
	}, []);
	if (keys.length === 1) return keys[0];
};
const deleteTranslationKey = async (name) => {
	const key = await getKeyByName(name);
	if (key?.id) return await callApiFunction(async ([keyId]) => {
		return await keysApi.keyDelete({
			projectId: phraseProjectId,
			id: keyId
		});
	}, [key.id]);
};
const getEnTranslationForKeyByKeyId = async (keyId) => {
	const enTranslations = (await callApiFunction(async () => {
		return await translationsApi.translationsByKey({
			projectId: phraseProjectId,
			keyId
		});
	}, [])).filter((translation) => translation.locale?.code === "en");
	if (enTranslations.length === 1) return enTranslations[0];
};
const getTranslationByKeyName = async (name) => {
	const key = await getKeyByName(name);
	if (key?.id) return {
		translation: await getEnTranslationForKeyByKeyId(key.id),
		key
	};
};
const updateTranslationKey = async ({ name, value }) => {
	const result = await getTranslationByKeyName(name);
	if (result?.translation?.id) {
		const updatedTranslation = await callApiFunction(async ([translationId]) => {
			return await translationsApi.translationUpdate({
				projectId: phraseProjectId,
				id: translationId,
				translationUpdateParameters: { content: value }
			});
		}, [result.translation.id]);
		return {
			key: result?.key,
			translation: updatedTranslation
		};
	}
};
const createTranslationKey = async ({ name, value }) => {
	const key = await callApiFunction(async () => {
		return await keysApi.keyCreate({
			projectId: phraseProjectId,
			keyCreateParameters: {
				name,
				defaultTranslationContent: value
			}
		});
	}, []);
	if (key.id) return {
		key,
		translation: await callApiFunction(async ([keyId]) => {
			return await getEnTranslationForKeyByKeyId(keyId);
		}, [key.id])
	};
};
const createPhraseJob = async ({ name, briefing, dueDate, ticketUrl, translationKeyIds }) => {
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
		const deLocale = (await callApiFunction(async () => {
			return await localesApi.localesList({ projectId: phraseProjectId });
		}, [])).filter(({ code }) => code === "de");
		if (deLocale.length === 1 && deLocale[0].id) await callApiFunction(async ([jobId, deLocaleId]) => {
			await jobLocalesApi.jobLocalesCreate({
				projectId: phraseProjectId,
				jobId,
				jobLocalesCreateParameters: { localeId: deLocaleId }
			});
		}, [job.id, deLocale[0].id]);
	}
	return job;
};
const updatePhraseJob = async ({ jobId, translationKeyIds }) => {
	return callApiFunction(async () => {
		return await jobsApi.jobKeysCreate({
			projectId: phraseProjectId,
			id: jobId,
			jobKeysCreateParameters: { translationKeyIds }
		});
	}, []);
};
//#endregion
//#region src/pull.ts
const pull = async ({ localesDirPath, phraseProjectId, preserveLocalKeys = true }) => {
	setPhraseProjectId(phraseProjectId);
	prepareTmpDir();
	await Promise.all(supportedLocales.map((locale) => downloadLocale(locale)));
	await Promise.all(supportedLocales.map((locale) => createLocaleFiles({
		locale,
		localesDirPath,
		preserveLocalKeys: preserveLocalKeys && locale === "en"
	})));
	clearTmpDir();
	console.log("Phrase translations are pulled");
};
//#endregion
//#region src/push.ts
const modifiedTranslationKeys = [];
const push = async ({ phraseProjectName, phraseProjectId, localesDirPath, allowDelete = false }) => {
	setPhraseProjectId(phraseProjectId);
	prepareTmpDir();
	const phraseObj = await downloadLocale("en", false);
	const localObj = await composeLocalLocaleFile({
		locale: "en",
		localesDirPath
	});
	const jobs = await getJobs();
	const translationsDiff = await findModifiedTranslationKeys(phraseObj, localObj);
	if (Object.keys(translationsDiff.added).length + Object.keys(translationsDiff.updated).length + (allowDelete ? Object.keys(translationsDiff.deleted).length : 0) === 0) {
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
			console.log(`Translation key ${result.key.id} was created. En translation id ${result.translation?.id} "${result.translation?.content}"`);
			if (result.key) modifiedTranslationKeys.push(result.key);
		}
	}
	for (const [name, value] of Object.entries(translationsDiff.updated)) {
		console.log(`Updating translation key ${name} ${value}`);
		const result = await updateTranslationKey({
			name,
			value
		});
		if (result?.translation && result?.key) {
			console.log(`Translation key ${result.translation.id} was updated to "${result.translation.content}"`);
			modifiedTranslationKeys.push(result.key);
		}
	}
	if (allowDelete) for (const [name] of Object.entries(translationsDiff.deleted)) {
		console.log(`Deleting translation key ${name}`);
		await deleteTranslationKey(name);
		console.log(`Translation key ${name} was deleted`);
	}
	else if (Object.keys(translationsDiff.deleted).length > 0) for (const [name] of Object.entries(translationsDiff.deleted)) console.log(`Skipping deletion of "${name}" — pass allowDelete: true to remove it from Phrase`);
	if (userInput.phraseJob === "CREATE_NEW") {
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
		console.log(`Job was successfully created https://app.phrase.com/accounts/deeploi/projects/${phraseProjectName}/jobs/${job.id}`);
		console.log("Attach screen-shots for each translation and \"start\" a job manually from the Phrase UI when you are ready");
	} else if (userInput.phraseJob === "DO_NOT_CREATE") console.log("Phrase job was not created");
	else if (userInput.phraseJob) {
		const job = await updatePhraseJob({
			jobId: userInput.phraseJob,
			translationKeyIds: modifiedTranslationKeys.filter((translation) => translation.id).map((translation) => translation.id)
		});
		console.log(`Job was successfully updated https://app.phrase.com/accounts/deeploi/projects/${phraseProjectName}/jobs/${job.id}`);
	}
	await clearTmpDir();
};
//#endregion
export { pull, push };
