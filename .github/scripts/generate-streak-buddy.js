const fs = require("node:fs/promises");
const path = require("node:path");

const username = "JIYA-R5";
const apiBase = "https://api.github.com";
const contributionsApiBase = "https://github-contributions-api.jogruber.de/v4";
const outputDirectory = path.resolve(__dirname, "..", "..");
const token = process.env.GITHUB_TOKEN;
const weekInMilliseconds = 7 * 24 * 60 * 60 * 1000;

async function githubGet(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "JIYA-R5-profile-stats",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${details}`);
  }
  return response.json();
}

async function getRepositories() {
  const repositories = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubGet(
      `${apiBase}/users/${username}/repos?type=owner&per_page=100&page=${page}`,
    );
    if (!Array.isArray(batch)) {
      throw new Error("GitHub API returned an unexpected repository list.");
    }
    repositories.push(...batch);
    if (batch.length < 100) break;
  }
  return repositories;
}

async function getContributionCalendar(range) {
  const response = await fetch(
    `${contributionsApiBase}/${username}?y=${encodeURIComponent(range)}`,
    { headers: { "User-Agent": "JIYA-R5-profile-stats" } },
  );
  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Contribution calendar request failed (${response.status}): ${details}`,
    );
  }

  const data = await response.json();
  if (!Array.isArray(data.contributions)) {
    throw new Error("Contribution API returned an invalid calendar.");
  }
  for (const contribution of data.contributions) {
    if (
      typeof contribution.date !== "string"
      || !Number.isInteger(contribution.count)
      || contribution.count < 0
    ) {
      throw new Error("Contribution API returned an invalid daily contribution.");
    }
  }
  return data;
}

function getCurrentStreak(contributions) {
  const contributionsByDate = new Map(
    contributions.map(({ date, count }) => [date, count]),
  );
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  let date = contributionsByDate.get(todayKey) > 0 ? today : new Date(
    today.getTime() - 24 * 60 * 60 * 1000,
  );
  let streak = 0;

  while (contributionsByDate.get(date.toISOString().slice(0, 10)) > 0) {
    streak += 1;
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return streak;
}

async function getRecentActivity() {
  const cutoff = Date.now() - weekInMilliseconds;
  let page = 1;
  let pushes = 0;
  const activeDays = new Set();

  while (true) {
    const events = await githubGet(
      `${apiBase}/users/${username}/events?per_page=100&page=${page}`,
    );
    if (!Array.isArray(events)) {
      throw new Error("GitHub API returned an unexpected activity list.");
    }

    let hasEventsWithinWeek = false;
    for (const event of events) {
      const eventTime = Date.parse(event.created_at);
      if (!Number.isFinite(eventTime) || eventTime < cutoff) continue;
      hasEventsWithinWeek = true;
      if (event.type !== "PushEvent") continue;

      pushes += 1;
      activeDays.add(new Date(eventTime).toISOString().slice(0, 10));
    }

    if (events.length < 100 || !hasEventsWithinWeek) break;
    page += 1;
  }

  return { pushes, activeDays: activeDays.size };
}

function renderBuddy({ pushes, activeDays }) {
  const activity = pushes > 0
    ? `${pushes} public push${pushes === 1 ? "" : "es"} this week`
    : "Ready for your next push";
  const dayLabel = `${activeDays} of 7 days active`;
  const progressWidth = Math.round((activeDays / 7) * 280);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="250" viewBox="0 0 440 250" role="img" aria-labelledby="title description">
  <title id="title">Ember the Streak Fox</title>
  <desc id="description">${activity}; ${dayLabel}, based on public GitHub push events.</desc>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#121329"/><stop offset="1" stop-color="#171021"/></linearGradient>
    <linearGradient id="progress" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#6c8cff"/><stop offset="1" stop-color="#ff4d94"/></linearGradient>
  </defs>
  <rect x="1" y="1" width="438" height="248" rx="18" fill="url(#background)" stroke="#6c8cff" stroke-width="2"/>
  <g shape-rendering="crispEdges">
    <path fill="#ff9a5a" d="M56 39h12v-12h8v12h16v-8h8v16h16v16h8v44h-8v16h-16v12H68v-8H52v-16H40V59h8V47h8z"/>
    <path fill="#ffcf70" d="M60 55h48v40H60zM52 99h16v16H52zm48 0h16v16h-16z"/>
    <path fill="#27152c" d="M68 71h8v8h-8zm24 0h8v8h-8zM76 87h16v8H76z"/>
    <path fill="#ff4d94" d="M76 39h16v8H76z"/>
    <path fill="#6c8cff" d="M60 123h16v8H60zm32 0h16v8H92z"/>
    <path fill="#a9fef7" d="M32 63h8v8h-8zm92-16h8v8h-8z"/>
  </g>
  <text x="154" y="50" fill="#a9fef7" font-family="Segoe UI,Arial,sans-serif" font-size="12" letter-spacing="2">YOUR CODING COMPANION</text>
  <text x="154" y="81" fill="#f3f0ff" font-family="Segoe UI,Arial,sans-serif" font-size="22" font-weight="700">Ember the Streak Fox</text>
  <text x="154" y="107" fill="#aaa6bd" font-family="Segoe UI,Arial,sans-serif" font-size="13">Your public GitHub activity, updated regularly.</text>
  <text x="154" y="143" fill="#f3f0ff" font-family="Segoe UI,Arial,sans-serif" font-size="14" font-weight="600">${activity}</text>
  <text x="154" y="168" fill="#c7c3d6" font-family="Segoe UI,Arial,sans-serif" font-size="12">${dayLabel}</text>
  <rect x="154" y="181" width="280" height="9" rx="5" fill="#29243c"/>
  <rect x="154" y="181" width="${progressWidth}" height="9" rx="5" fill="url(#progress)"/>
</svg>
`;
}

function renderGitStats({ stars, repositories, currentStreak, forks, contributions, year }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="250" viewBox="0 0 440 250" role="img" aria-labelledby="title description">
  <title id="title">GitHub repository stats</title>
  <desc id="description">${stars} total stars, ${repositories} public repositories, a ${currentStreak}-day current streak, ${forks} forks, and ${contributions} contributions in ${year}.</desc>
  <defs><linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#121329"/><stop offset="1" stop-color="#171021"/></linearGradient></defs>
  <rect x="1" y="1" width="438" height="248" rx="18" fill="url(#background)" stroke="#ff4d94" stroke-width="2"/>
  <text x="24" y="34" fill="#ff4d94" font-family="Segoe UI,Arial,sans-serif" font-size="17" font-weight="700">GitHub Profile Stats</text>
  <g font-family="Segoe UI,Arial,sans-serif" font-size="12">
    <circle cx="31" cy="63" r="5" fill="#ffcf70"/>
    <text x="46" y="67" fill="#a9fef7">Total stars earned</text>
    <text x="277" y="67" fill="#f3f0ff" font-size="14" font-weight="700" text-anchor="end">${stars}</text>
    <circle cx="31" cy="94" r="5" fill="#ff4d94"/>
    <text x="46" y="98" fill="#a9fef7">Public repositories</text>
    <text x="277" y="98" fill="#f3f0ff" font-size="14" font-weight="700" text-anchor="end">${repositories}</text>
    <circle cx="31" cy="125" r="5" fill="#a9fef7"/>
    <text x="46" y="129" fill="#a9fef7">Current streak</text>
    <text x="277" y="129" fill="#f3f0ff" font-size="14" font-weight="700" text-anchor="end">${currentStreak} days</text>
    <circle cx="31" cy="156" r="5" fill="#6c8cff"/>
    <text x="46" y="160" fill="#a9fef7">Total forks</text>
    <text x="277" y="160" fill="#f3f0ff" font-size="14" font-weight="700" text-anchor="end">${forks}</text>
    <circle cx="31" cy="187" r="5" fill="#ff9a5a"/>
    <text x="46" y="191" fill="#a9fef7">Contributions in ${year}</text>
    <text x="277" y="191" fill="#f3f0ff" font-size="14" font-weight="700" text-anchor="end">${contributions}</text>
  </g>
  <circle cx="355" cy="112" r="47" fill="none" stroke="#29243c" stroke-width="8"/>
  <circle cx="355" cy="112" r="47" fill="none" stroke="#ff4d94" stroke-width="8" stroke-dasharray="214 82" stroke-linecap="round" transform="rotate(-90 355 112)"/>
  <text x="355" y="119" fill="#ffcf70" font-family="Segoe UI,Arial,sans-serif" font-size="26" font-weight="700" text-anchor="middle">JS</text>
  <text x="355" y="177" fill="#aaa6bd" font-family="Segoe UI,Arial,sans-serif" font-size="10" letter-spacing="1" text-anchor="middle">OPEN PROFILE</text>
</svg>
`;
}

async function main() {
  const year = new Date().getUTCFullYear();
  const [repositories, activity, profile, yearlyCalendar, recentCalendar] = await Promise.all([
    getRepositories(),
    getRecentActivity(),
    githubGet(`${apiBase}/users/${username}`),
    getContributionCalendar(year),
    getContributionCalendar("last"),
  ]);
  if (
    !Number.isInteger(profile.public_repos)
    || !Number.isInteger(yearlyCalendar.total?.[year])
  ) {
    throw new Error("GitHub profile or contribution API returned invalid stats.");
  }
  const stats = {
    repositories: profile.public_repos,
    stars: repositories.reduce((sum, repo) => sum + repo.stargazers_count, 0),
    forks: repositories.reduce((sum, repo) => sum + repo.forks_count, 0),
    currentStreak: getCurrentStreak(recentCalendar.contributions),
    contributions: yearlyCalendar.total[year],
    year,
  };

  await Promise.all([
    fs.writeFile(
      path.join(outputDirectory, "streak-buddy.svg"),
      renderBuddy(activity),
      "utf8",
    ),
    fs.writeFile(
      path.join(outputDirectory, "git-stats.svg"),
      renderGitStats(stats),
      "utf8",
    ),
  ]);
  console.log(
    `Updated streak-buddy.svg (${activity.pushes} public push events in the last 7 days) and git-stats.svg (${stats.contributions} contributions, ${stats.currentStreak}-day streak in ${year}).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
