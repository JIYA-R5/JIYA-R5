#!/usr/bin/env python3

import html
import json
import math
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


COLORS = {
    "JavaScript": "#f7df1e",
    "TypeScript": "#3178c6",
    "Python": "#4b9fea",
    "HTML": "#ff7043",
    "CSS": "#a678ff",
    "Java": "#f45b87",
    "C": "#8f9cf5",
    "C++": "#ff805c",
    "C#": "#8b70e8",
    "Go": "#45c8d8",
    "Rust": "#f08c56",
    "PHP": "#8e9be8",
    "Ruby": "#e85e6e",
    "Swift": "#ff7856",
    "Kotlin": "#a16bde",
    "Shell": "#79c98b",
}
PALETTE = ["#ff4d94", "#34c9a7", "#ffba32", "#399bea", "#9a70f5", "#ff805c"]
API = "https://api.github.com"
OUTPUT = "most-used-languages.svg"


def api_get(url, token):
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "JIYA-R5-language-wheel",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(url, headers=headers)
    try:
        with urlopen(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub API request failed ({error.code}) for {url}: {detail}") from error
    except URLError as error:
        raise RuntimeError(f"Could not reach GitHub API for {url}: {error.reason}") from error


def collect_language_totals(username, token):
    totals = {}
    page = 1
    while True:
        repos = api_get(
            f"{API}/users/{username}/repos?type=owner&per_page=100&page={page}",
            token,
        )
        if not isinstance(repos, list):
            raise RuntimeError(f"Unexpected repository response for {username}")
        for repo in repos:
            if repo.get("fork"):
                continue
            languages = api_get(repo["languages_url"], token)
            for language, byte_count in languages.items():
                totals[language] = totals.get(language, 0) + byte_count
        if len(repos) < 100:
            break
        page += 1
    return totals


def arc_segment(offset, length, circumference, color):
    return (
        f'<circle cx="238" cy="205" r="112" fill="none" stroke="{color}" '
        f'stroke-width="30" stroke-linecap="round" '
        f'stroke-dasharray="{length:.2f} {circumference - length:.2f}" '
        f'stroke-dashoffset="{-offset:.2f}"/>'
    )


def render_svg(totals):
    ranked = sorted(totals.items(), key=lambda item: item[1], reverse=True)
    total_bytes = sum(count for _, count in ranked)
    if total_bytes == 0:
        raise RuntimeError("No language data found in the user's public repositories")

    top = ranked[:5]
    if len(ranked) > 5:
        top.append(("Other", sum(count for _, count in ranked[5:])))

    circumference = 2 * math.pi * 112
    segments = []
    offset = 0.0
    legend = []
    for index, (language, count) in enumerate(top):
        length = circumference * count / total_bytes
        color = COLORS.get(language, PALETTE[index % len(PALETTE)])
        segments.append(arc_segment(offset, length, circumference, color))
        offset += length
        percentage = count * 100 / total_bytes
        legend.append((language, percentage, color))

    first_language, first_count = top[0]
    first_percentage = first_count * 100 / total_bytes
    legend_markup = []
    for index, (language, percentage, color) in enumerate(legend):
        x = 485 + (index % 2) * 190
        y = 156 + (index // 2) * 66
        legend_markup.append(
            f'<circle cx="{x}" cy="{y}" r="6" fill="{color}"/>'
            f'<text x="{x + 16}" y="{y + 5}" class="language">{html.escape(language)}</text>'
            f'<text x="{x + 16}" y="{y + 25}" class="percentage">{percentage:.1f}%</text>'
        )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="900" height="410" viewBox="0 0 900 410" role="img" aria-labelledby="title description">
  <title id="title">Most-used programming languages</title>
  <desc id="description">A rotating 3D-style chart of language usage across public repositories. {html.escape(first_language)} is the most-used language at {first_percentage:.1f}%.</desc>
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#100a20"/>
      <stop offset="1" stop-color="#080715"/>
    </linearGradient>
    <radialGradient id="centerGlow">
      <stop stop-color="#40305d" stop-opacity=".85"/>
      <stop offset="1" stop-color="#100a20" stop-opacity=".15"/>
    </radialGradient>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="200%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
  </defs>
  <style>
    text {{ font-family: Inter, ui-sans-serif, system-ui, sans-serif; }}
    .eyebrow {{ fill: #a79ac7; font-size: 13px; letter-spacing: 2px; }}
    .heading {{ fill: #f4efff; font-size: 23px; font-weight: 700; }}
    .language {{ fill: #eee8ff; font-size: 14px; font-weight: 600; }}
    .percentage {{ fill: #9c91b7; font-size: 12px; }}
    .orbit {{ transform-origin: 238px 205px; animation: revolve 18s linear infinite; }}
    .ring-motion {{ transform-origin: 238px 205px; animation: revolve 32s linear infinite; }}
    @keyframes revolve {{ to {{ transform: rotate(360deg); }} }}
    @media (prefers-reduced-motion: reduce) {{ .orbit, .ring-motion {{ animation: none; }} }}
  </style>
  <rect width="900" height="410" rx="26" fill="url(#background)" stroke="#ff4d94" stroke-opacity=".65"/>
  <circle cx="238" cy="206" r="172" fill="#ff4d94" opacity=".045"/>
  <text x="44" y="46" class="eyebrow">LIVE REPOSITORY LANGUAGE MIX</text>
  <text x="44" y="82" class="heading">Most-used languages</text>
  <ellipse cx="238" cy="226" rx="140" ry="111" fill="#000" opacity=".5" filter="url(#shadow)"/>
  <ellipse cx="238" cy="205" rx="151" ry="119" fill="none" stroke="#49325d" stroke-opacity=".45" stroke-dasharray="2 8"/>
  <g class="orbit">
    <circle cx="389" cy="205" r="7" fill="#35d8b2"/>
    <circle cx="87" cy="205" r="5" fill="#ff4d94"/>
    <circle cx="238" cy="86" r="4" fill="#ffba32"/>
  </g>
  <g transform="rotate(-90 238 205)">
    <circle cx="238" cy="205" r="112" fill="none" stroke="#241934" stroke-width="30"/>
    <g class="ring-motion">{"".join(segments)}</g>
  </g>
  <circle cx="238" cy="205" r="78" fill="url(#centerGlow)" stroke="#70416d" stroke-opacity=".7" stroke-width="2"/>
  <circle cx="238" cy="205" r="63" fill="none" stroke="#a57ee8" stroke-opacity=".18" stroke-width="1"/>
  <text x="238" y="190" text-anchor="middle" class="eyebrow">TOP LANGUAGE</text>
  <text x="238" y="221" text-anchor="middle" fill="#fff" font-size="21" font-weight="700">{html.escape(first_language)}</text>
  <text x="238" y="248" text-anchor="middle" fill="#ff8abb" font-size="16" font-weight="700">{first_percentage:.1f}%</text>
  <path d="M470 116v208" stroke="#493858" stroke-opacity=".7"/>
  {"".join(legend_markup)}
  <text x="44" y="374" class="percentage">Language totals refresh automatically after repository updates.</text>
</svg>
"""


def main():
    if len(sys.argv) != 2:
        raise RuntimeError("Usage: generate-most-used-languages.py <github-username>")
    username = sys.argv[1]
    token = os.environ.get("GITHUB_TOKEN")
    totals = collect_language_totals(username, token)
    with open(OUTPUT, "w", encoding="utf-8") as svg_file:
        svg_file.write(render_svg(totals))
    print(f"Generated {OUTPUT} from {len(totals)} programming languages.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, KeyError, TypeError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
