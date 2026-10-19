# E-Hentai 标签分组采集工具

## 功能说明

`fetch_taggroups.py` 从 E-Hentai 标签分组工具页面采集主标签及其子标签，用于构建本地标签数据库。

## 认证配置

访问标签工具页面需要 E-Hentai 登录态。可以通过文件或环境变量提供 Cookie。

### 方式一：通过文件

将浏览器的 `Cookie` 请求头内容写入 `tool/.eh-cookie`（单行文本）：

```powershell
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie
```

### 方式二：通过环境变量

```powershell
$env:EH_COOKIE = 'ipb_member_id=...; ipb_pass_hash=...'
python tool/fetch_taggroups.py
```

## 使用示例

```powershell
# 测试模式：仅采集一个分组
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie --show 10

# 强制刷新：忽略缓存重新抓取
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie --refresh

# 自定义请求参数：调整延迟和并发数
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie --delay 0.5 --workers 2
```

## 输出格式

生成的 `taggroup-data.json` 包含所有标签分组数据：

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

## 缓存机制

下载的 HTML 页面缓存在 `tool/.cache/` 目录，中断后可从缓存恢复，避免重复请求。缓存目录和 `.eh-cookie` 文件均已添加到 `.gitignore`。

## Excel 导出

安装 `openpyxl` 后可将数据导出为 Excel 格式，每个命名空间一个工作表：

```powershell
python -m pip install openpyxl
python tool/export_taggroups_excel.py
```

生成的 `tool/taggroup-data.xlsx` 每行表示一个主标签，列为：`小类`、`显示名`、`子类1`、`子类2` 等。
