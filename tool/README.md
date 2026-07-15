# E-Hentai Tag Group Collector

`fetch_taggroups.py` collects master tags and their child tags from
`https://repo.e-hentai.org/tools/taggroup` and writes them to
`taggroup-data.json`.

The tools page requires an authenticated E-Hentai session. Put the value of
the browser's `Cookie` request header in `tool/.eh-cookie` as a single line,
then run:

```powershell
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie
```

Alternatively, provide it through the environment without writing it to the
project:

```powershell
$env:EH_COOKIE = 'ipb_member_id=...; ipb_pass_hash=...'
python tool/fetch_taggroups.py
```

Useful options:

```powershell
# Collect one group while testing.
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie --show 10

# Ignore cached pages and fetch them again.
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie --refresh

# Change request rate and worker count.
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie --delay 0.5 --workers 2
```

Example output:

```json
{
  "cosplayer": {
    "9797san": {
      "dispName": "9797san",
      "sub": ["9797san", "97 daemo", "97daemo"]
    }
  }
}
```

Downloaded HTML is cached in `tool/.cache/` so interrupted runs can resume
without requesting completed pages again. Both the cache and `.eh-cookie` are
ignored by Git.

## Excel export

Install `openpyxl`, then export the collected JSON to one worksheet per
namespace:

```powershell
python -m pip install openpyxl
python tool/export_taggroups_excel.py
```

The generated `tool/taggroup-data.xlsx` uses one master tag per row with
columns `小类`, `显示名`, `子类1`, `子类2`, and so on.
