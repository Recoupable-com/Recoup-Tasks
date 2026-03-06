export const SUBMODULE_CONFIG: Record<string, { repo: string; baseBranch: string }> = {
  api: { repo: "recoupable/recoup-api", baseBranch: "test" },
  chat: { repo: "recoupable/chat", baseBranch: "test" },
  tasks: { repo: "recoupable/tasks", baseBranch: "main" },
  docs: { repo: "recoupable/docs", baseBranch: "main" },
  database: { repo: "recoupable/database", baseBranch: "main" },
  remotion: { repo: "recoupable/remotion", baseBranch: "main" },
  bash: { repo: "recoupable/bash", baseBranch: "main" },
  skills: { repo: "recoupable/skills", baseBranch: "main" },
  cli: { repo: "recoupable/cli", baseBranch: "main" },
};
