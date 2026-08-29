import { logger } from "@trigger.dev/sdk/v3";

export interface PRReview {
  author: string;
  body: string;
  state: string;
  submittedAt: string;
}

export interface PRLineComment {
  author: string;
  body: string;
  path: string;
  createdAt: string;
}

export interface PRFeedback {
  reviews: PRReview[];
  comments: PRLineComment[];
}

/**
 * Fetches review bodies and inline comments from a GitHub PR.
 *
 * @param repo - GitHub repo in "owner/repo" format
 * @param prNumber - The PR number
 */
export async function fetchPRReviews(repo: string, prNumber: number): Promise<PRFeedback> {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
  };

  const [reviewsRes, commentsRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/reviews`, { headers }),
    fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/comments`, { headers }),
  ]);

  const reviews: PRReview[] = [];
  const comments: PRLineComment[] = [];

  if (reviewsRes.ok) {
    const data = (await reviewsRes.json()) as Array<{
      user: { login: string };
      body: string;
      state: string;
      submitted_at: string;
    }>;
    reviews.push(
      ...data
        .filter((r) => r.body?.trim())
        .map((r) => ({
          author: r.user.login,
          body: r.body,
          state: r.state,
          submittedAt: r.submitted_at,
        })),
    );
  } else {
    logger.warn(`Failed to fetch reviews for PR #${prNumber} in ${repo}`);
  }

  if (commentsRes.ok) {
    const data = (await commentsRes.json()) as Array<{
      user: { login: string };
      body: string;
      path: string;
      created_at: string;
    }>;
    comments.push(
      ...data.map((c) => ({
        author: c.user.login,
        body: c.body,
        path: c.path,
        createdAt: c.created_at,
      })),
    );
  } else {
    logger.warn(`Failed to fetch comments for PR #${prNumber} in ${repo}`);
  }

  return { reviews, comments };
}
