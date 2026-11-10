import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

const httpsAgent = process.env.PROXY_URL
    ? new HttpsProxyAgent(process.env.PROXY_URL)
    : undefined;

// Unauthenticated GitHub API calls are limited to 60/hour per IP, which is
// shared with other tenants on most hosting platforms. A token (no scopes
// needed for public repos) raises the limit to 5000/hour.
const githubHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ai-interviewer",
};

if (process.env.GITHUB_TOKEN) {
    githubHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

export async function scrapeGithub(username: string) {
    const userRepos = await axios.request({
        url: `https://api.github.com/users/${username}/repos`,
        params: { per_page: 100, sort: "updated" },
        headers: githubHeaders,
        httpsAgent,
    });

    return userRepos.data.map((x: any) => ({
        description: x.description,
        name: x.name,
        fullName: x.full_name,
        starCount: x.stargazers_count
    }));
}