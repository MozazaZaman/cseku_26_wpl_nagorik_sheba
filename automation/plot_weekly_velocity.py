import os
import requests
import matplotlib.pyplot as plt

OWNER = "MozazaZaman"
REPO = "cseku_26_wpl_nagorik_sheba"
BRANCHES = ["0.1", "0.2", "0.3", "0.4", "0.5"]
OUT_PATH = "weekly-velocity-pie.png"

token = os.getenv("GITHUB_TOKEN")
headers = {"Accept": "application/vnd.github+json"}
if token:
    headers["Authorization"] = f"token {token}"

def get_last_page_from_link(link_header):
    if not link_header:
        return None
    for part in link_header.split(","):
        if 'rel="last"' in part:
            url_part = part.split(";")[0].strip().strip("<>")
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(url_part).query)
            if "page" in qs:
                return int(qs["page"][0])
    return None

def get_commit_count(branch):
    url = f"https://api.github.com/repos/{OWNER}/{REPO}/commits"
    r = requests.get(url, headers=headers, params={"sha": branch, "per_page": 1})
    r.raise_for_status()
    last_page = get_last_page_from_link(r.headers.get("Link"))
    if last_page is not None:
        return last_page
    return len(r.json())

counts, labels = [], []
for b in BRANCHES:
    try:
        c = get_commit_count(b)
    except requests.HTTPError as e:
        print(f"Failed for {b}: {e}")
        c = 0
    counts.append(c)
    labels.append(b)

total = sum(counts)
if total == 0:
    raise SystemExit("Total commits is 0; check branch names.")

fig, ax = plt.subplots(figsize=(7, 7))
wedges, texts, autotexts = ax.pie(
    counts, labels=labels,
    autopct=lambda pct: f"{pct:.1f}%\n({int(round(pct * total / 100))})",
    startangle=140, textprops=dict(color="white"),
    wedgeprops=dict(edgecolor="black"),
)
ax.set_title("Weekly velocity (commits per branch)")
plt.legend(wedges, [f"{l}: {c} commits" for l, c in zip(labels, counts)],
           title="Branches", bbox_to_anchor=(1.05, 1), loc="upper left")
plt.tight_layout()
plt.savefig(OUT_PATH, dpi=150)
print(f"Saved to {OUT_PATH}")
