export interface AllocatableQuestion {
  id: string;
}

export function allocateSessionQuestions<T extends AllocatableQuestion>(
  candidates: T[],
  recentlyUsedQuestionIds: ReadonlySet<string>,
  requestedCount: number
): T[] {
  if (requestedCount <= 0) return [];

  const unseen = candidates.filter(
    (question) => !recentlyUsedQuestionIds.has(question.id)
  );
  const repeated = candidates.filter((question) =>
    recentlyUsedQuestionIds.has(question.id)
  );

  return [...unseen, ...repeated].slice(0, requestedCount);
}
