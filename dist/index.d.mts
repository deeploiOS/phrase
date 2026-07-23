//#region src/pull.d.ts
declare const pull: ({ localesDirPath, phraseProjectId, preserveLocalKeys }: {
  localesDirPath: string;
  phraseProjectId: string;
  preserveLocalKeys?: boolean;
}) => Promise<void>;
//#endregion
//#region src/push.d.ts
declare const push: ({ phraseProjectName, phraseProjectId, localesDirPath, allowDelete }: {
  phraseProjectName: string;
  phraseProjectId: string;
  localesDirPath: string;
  allowDelete?: boolean;
}) => Promise<void>;
//#endregion
export { pull, push };