declare const pull: ({ localesDirPath, phraseProjectId, preserveLocalKeys, }: {
    localesDirPath: string;
    phraseProjectId: string;
    preserveLocalKeys?: boolean;
}) => Promise<void>;

declare const push: ({ phraseProjectName, phraseProjectId, localesDirPath, allowDelete, }: {
    phraseProjectName: string;
    phraseProjectId: string;
    localesDirPath: string;
    allowDelete?: boolean;
}) => Promise<void>;

export { pull, push };
