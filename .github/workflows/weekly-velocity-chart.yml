name: Weekly Velocity Chart
on:
  workflow_dispatch:
  schedule:
    - cron: '0 6 * * 1' # every Monday at 06:00 UTC

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'

      - name: Install deps
        run: |
          python -m pip install --upgrade pip
          pip install requests matplotlib

      - name: Run plot script
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          python plot_weekly_velocity.py --owner MozazaZaman --repo cseku_26_wpl_nagorik_sheba --branches 0.1 0.2 0.3 0.4 0.5 --out charts/weekly-velocity-pie.png || true

      - name: Commit chart
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add charts/weekly-velocity-pie.png || true
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            git commit -m "Automated: update weekly velocity pie chart"
            git push origin automation/weekly-velocity-chart
          fi
