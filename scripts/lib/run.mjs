import { inspectEntries } from "./inspect.mjs";
import { checkRepo, loadRepo } from "./repo.mjs";

export async function collect(root, registry) {
  const repo = await loadRepo(root);
  const errors = [...repo.errors, ...(await checkRepo(repo))];
  if (errors.length > 0) return { errors, repo, resolved: new Map() };
  const inspected = await inspectEntries(repo, registry);
  return { errors: inspected.errors, repo, resolved: inspected.resolved };
}
