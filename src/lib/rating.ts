import type { ResultRow, Submission } from "../types";

const placementDelta = [25, 18, 12, 7, 3, -3, -7, -12, -18, -25];

export function calculateResults(
  submissions: Submission[],
  userSubmission: Submission,
  votes: Record<string, number>,
): ResultRow[] {
  const all = [...submissions, userSubmission];

  return all
    .map((submission) => {
      const userVote = votes[submission.id];
      // Demo seed represents eight votes already cast. The user's vote is the ninth.
      const score =
        submission.id === userSubmission.id
          ? submission.baseScore
          : (submission.baseScore * 8 + userVote) / 9;
      return { submission, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({
      ...row,
      place: index + 1,
      delta: placementDelta[index],
      isUser: row.submission.id === userSubmission.id,
    }));
}
