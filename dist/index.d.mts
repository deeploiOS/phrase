declare const pull: ({ localesDirPath, phraseProjectId, }: {
    localesDirPath: string;
    phraseProjectId: string;
}) => Promise<void>;

declare const push: ({ phraseProjectName, phraseProjectId, localesDirPath, }: {
    phraseProjectName: string;
    phraseProjectId: string;
    localesDirPath: string;
}) => Promise<void>;

export { pull, push };
