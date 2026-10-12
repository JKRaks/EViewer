# E-Hentai 标签组采集工具 / Tag Group Collector

## 用途 / Purpose

`fetch_taggroups.py` 从 E-Hentai 的标签分组工具页面采集主标签及其子标签，用于构建本地标签数据库，提升搜索和标签选择器的体验。

This script collects master tags and their child tags from `https://repo.e-hentai.org/tools/taggroup` and writes them to `taggroup-data.json` for local tag database construction.

## 认证配置 / Authentication

访问标签工具页面需要 E-Hentai 登录态。将浏览器的 `Cookie` 请求头写入 `tool/.eh-cookie`（单行），或通过环境变量提供。

The tools page requires an authenticated E-Hentai session. Put the value of the browser's `Cookie` request header in `tool/.eh-cookie` as a single line, or provide via environment variable.

**通过文件 / Via file:**
```powershell
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie
```

**通过环境变量（不写入项目） / Via environment (no file):**
```powershell
$env:EH_COOKIE = 'ipb_member_id=...; ipb_pass_hash=...'
python tool/fetch_taggroups.py
```

## 常用选项 / Common Options

```powershell
# 测试时仅采集一个分组 / Collect one group while testing
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie --show 10

# 忽略缓存，重新抓取 / Ignore cached pages and fetch them again
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie --refresh

# 调整请求频率和并发数 / Change request rate and worker count
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie --delay 0.5 --workers 2
```

## 输出格式 / Output Format

生成的 `taggroup-data.json` 格式示例：

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

## 缓存机制 / Caching

下载的 HTML 缓存在 `tool/.cache/`，中断后可恢复，避免重复请求。缓存目录和 `.eh-cookie` 均已忽略 Git 提交。

Downloaded HTML is cached in `tool/.cache/` so interrupted runs can resume without requesting completed pages again. Both the cache and `.eh-cookie` are ignored by Git.

## Excel 导出 / Excel Export

安装 `openpyxl` 后可导出为 Excel，每个命名空间一个工作表。

Install `openpyxl`, then export the collected JSON to one worksheet per namespace:

```powershell
python -m pip install openpyxl
python tool/export_taggroups_excel.py
```

生成的 `tool/taggroup-data.xlsx` 每行一个主标签，列为：`小类`、`显示名`、`子类1`、`子类2` 等。

The generated `tool/taggroup-data.xlsx` uses one master tag per row with columns `小类`, `显示名`, `子类1`, `子类2`, and so on.
