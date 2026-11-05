const fs = require("node:fs/promises");
const path = require("node:path");

const username = "JIYA-R5";
const outputPath = path.resolve(__dirname, "..", "..", "top-languages-3d.svg");
const apiBase = "https://api.github.com";
const token = process.env.GITHUB_TOKEN;

const languageColors = {
  "C": "#8f9bff",
  "C#": "#9b6bce",
  "C++": "#f34b7d",
  "CSS": "#d266ff",
  "Go": "#00add8",
  "HTML": "#ff7148",
  "Java": "#f89820",
  "JavaScript": "#ffd34e",
  "Kotlin": "#a97bff",
  "PHP": "#4f5d95",
  "Python": "#35d7e8",
  "Ruby": "#701516",
  "Rust": "#dea584",
  "Shell": "#89e051",
  "TypeScript": "#7568ff",
};

const palette = [
  "#ffbd2e",
  "#28c7fa",
  "#a56eff",
  "#ff4f81",
  "#00d6a3",
  "#ff8b45",
  "#72e0ff",
];

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]);
}

function darken(hex, factor = 0.58) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((channel) =>
    Math.round(parseInt(channel, 16) * factor)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${channels.join("")}`;
}

async function githubGet(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "JIYA-R5-profile-language-card",
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
  return repositories.filter((repo) => !repo.fork && !repo.archived);
}

async function getLanguageTotals() {
  const repositories = await getRepositories();
  const results = await Promise.all(
    repositories.map((repo) => githubGet(repo.languages_url)),
  );
  const totals = new Map();

  for (const languages of results) {
    for (const [language, bytes] of Object.entries(languages)) {
      totals.set(language, (totals.get(language) || 0) + bytes);
    }
  }

  const ranked = [...totals.entries()]
    .filter(([, bytes]) => bytes > 0)
    .sort((left, right) => right[1] - left[1]);
  const totalBytes = ranked.reduce((sum, [, bytes]) => sum + bytes, 0);
  if (totalBytes === 0) {
    throw new Error("No language data was found in the public repositories.");
  }

  const displayed = ranked.slice(0, 5);
  const otherBytes = ranked.slice(5).reduce((sum, [, bytes]) => sum + bytes, 0);
  if (otherBytes > 0) displayed.push(["Other", otherBytes]);
  return { displayed, totalBytes };
}

function renderSvg({ displayed, totalBytes }) {
  const centerX = 250;
  const centerY = 232;
  const radius = 121;
  const strokeWidth = 34;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const entries = displayed.map(([name, bytes], index) => {
    const fraction = bytes / totalBytes;
    const color = languageColors[name] || palette[index % palette.length];
    const gap = Math.min(circumference * 0.012, circumference * fraction * 0.1);
    const length = Math.max(0, circumference * fraction - gap);
    const dashOffset = -offset - gap / 2;
    offset += circumference * fraction;

    return {
      name,
      bytes,
      color,
      fraction,
      gradientId: `language-gradient-${index}`,
      dashArray: `${length.toFixed(2)} ${(circumference - length).toFixed(2)}`,
      dashOffset: dashOffset.toFixed(2),
    };
  });

  const gradients = entries.map((entry) => `
    <linearGradient id="${entry.gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${entry.color}" />
      <stop offset="100%" stop-color="${darken(entry.color)}" />
    </linearGradient>`).join("");

  const arcs = entries.map((entry) => `
      <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none"
        stroke="url(#${entry.gradientId})" stroke-width="${strokeWidth}"
        stroke-linecap="butt" stroke-dasharray="${entry.dashArray}"
        stroke-dashoffset="${entry.dashOffset}" />`).join("");

  const rows = entries.map((entry, index) => {
    const y = 131 + index * 49;
    const percentage = (entry.fraction * 100).toFixed(1);
    const barWidth = (entry.fraction * 226).toFixed(1);
    return `
      <g class="language-row" style="animation-delay:${index * 90}ms">
        <circle cx="451" cy="${y - 4}" r="5" fill="${entry.color}" />
        <text x="466" y="${y}" class="language-name">${escapeXml(entry.name)}</text>
        <text x="715" y="${y}" class="language-percent" text-anchor="end">${percentage}%</text>
        <rect x="466" y="${y + 9}" width="226" height="4" rx="2" fill="#26213a" />
        <rect x="466" y="${y + 9}" width="${barWidth}" height="4" rx="2" fill="${entry.color}" />
      </g>`;
  }).join("");

  const orbitalDots = [
    [107, 133, 2.4, "0s"],
    [385, 119, 2, "1.1s"],
    [368, 343, 2.8, "2s"],
    [121, 332, 1.8, "0.6s"],
    [416, 212, 1.7, "1.5s"],
  ].map(([x, y, radiusValue, delay]) => `
      <circle cx="${x}" cy="${y}" r="${radiusValue}" class="orbit-dot" style="animation-delay:${delay}" />`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="780" height="460" viewBox="0 0 780 460" role="img" aria-labelledby="title description">
  <title id="title">Jiya Shah's most used programming languages</title>
  <desc id="description">An animated 3D-style donut chart showing programming language usage across public, non-fork repositories. The values refresh automatically every 30 minutes.</desc>
  <defs>
    <radialGradient id="background" cx="48%" cy="42%" r="80%">
      <stop offset="0%" stop-color="#17102a" />
      <stop offset="100%" stop-color="#080611" />
    </radialGradient>
    <radialGradient id="center-fill">
      <stop offset="0%" stop-color="#211633" />
      <stop offset="100%" stop-color="#0e0a19" />
    </radialGradient>
    <filter id="soft-shadow" x="-40%" y="-40%" width="180%" height="190%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="blur" />
      <feOffset dy="9" result="offset-blur" />
      <feComponentTransfer><feFuncA type="linear" slope="0.7" /></feComponentTransfer>
      <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    ${gradients}
  </defs>
  <style>
    text { font-family: 'Segoe UI', Ubuntu, Arial, sans-serif; }
    .micro { fill: #9c92c5; font-size: 11px; letter-spacing: 1.8px; }
    .language-name { fill: #e8e3f5; font-size: 15px; font-weight: 600; }
    .language-percent { fill: #c9c0e0; font-size: 14px; font-weight: 700; }
    .ring { animation: shimmer 4s ease-in-out infinite alternate; }
    .orb { transform-origin: ${centerX}px ${centerY}px; animation: breathe 3s ease-in-out infinite; }
    .status-dot { animation: pulse 2s ease-in-out infinite; }
    .orbit-dot { fill: #ff4f9a; opacity: .7; transform-box: fill-box; transform-origin: center; animation: twinkle 2.4s ease-in-out infinite alternate; }
    .language-row { animation: rise-in .7s ease-out both; }
    @keyframes shimmer { to { opacity: .86; } }
    @keyframes breathe { 50% { transform: scale(1.06); opacity: .75; } }
    @keyframes pulse { 50% { opacity: .45; } }
    @keyframes twinkle { to { opacity: .18; transform: scale(.65); } }
    @keyframes rise-in { from { opacity: 0; } to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      .ring, .orb, .status-dot, .orbit-dot, .language-row { animation: none; opacity: 1; }
    }
  </style>

  <rect x="1" y="1" width="778" height="458" rx="24" fill="url(#background)" stroke="#ed3e8c" stroke-width="2" />
  <path d="M22 76H758" stroke="#382447" stroke-width="1" />
  ${orbitalDots}
  <text x="30" y="35" class="micro">@JIYA-R5 · CODE UNIVERSE</text>
  <text x="30" y="61" fill="#f3edff" font-size="18" font-weight="700">MOST USED LANGUAGES</text>
  <g transform="translate(606 31)">
    <circle cx="0" cy="0" r="4" fill="#00d6a3" class="status-dot" />
    <text x="12" y="4" class="micro" font-size="9">AUTO-REFRESH · 30 MIN</text>
  </g>

  <circle cx="${centerX}" cy="${centerY + 9}" r="${radius}" fill="none" stroke="#05040c" stroke-width="${strokeWidth + 18}" opacity=".72" filter="url(#soft-shadow)" />
  <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="#242037" stroke-width="${strokeWidth}" />
  <g class="ring" transform="rotate(-90 ${centerX} ${centerY})">
    ${arcs}
  </g>
  <circle cx="${centerX}" cy="${centerY}" r="${radius - strokeWidth / 2 - 7}" fill="url(#center-fill)" stroke="#352544" stroke-width="1.5" />
  <circle cx="${centerX}" cy="${centerY}" r="53" fill="none" stroke="#a42f79" stroke-width="2" opacity=".52" class="orb" />
  <text x="${centerX}" y="${centerY - 13}" fill="#9d91bd" font-size="10" text-anchor="middle" letter-spacing="2.4">TOP LANGS</text>
  <text x="${centerX}" y="${centerY + 13}" fill="#fff5ff" font-size="17" font-weight="700" text-anchor="middle">BY BYTES</text>
  <text x="${centerX}" y="${centerY + 36}" fill="#a69abb" font-size="10" text-anchor="middle">${entries.length} CATEGORIES</text>

  <text x="451" y="99" class="micro">LANGUAGE BREAKDOWN</text>
  ${rows}
  <text x="30" y="434" fill="#756b91" font-size="10">Based on language bytes in public, non-fork repositories</text>
  <text x="750" y="434" fill="#756b91" font-size="10" text-anchor="end">${entries.length} categories · live GitHub data</text>
</svg>
`;
}

async function main() {
  const stats = await getLanguageTotals();
  await fs.writeFile(outputPath, renderSvg(stats), "utf8");
  console.log(`Generated ${path.relative(process.cwd(), outputPath)} from ${stats.displayed.length} language categories.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
