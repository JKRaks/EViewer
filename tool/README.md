# E-Hentai Tag Group Collector

## 用途

`fetch_taggroups.py` 从 E-Hentai 标签分组工具页面采集主标签及其子标签，用于构建本地标签数据库。

## 认证配置

访问标签工具页面需要 E-Hentai 登录态。将浏览器的 `Cookie` 请求头写入 `tool/.eh-cookie`（单行），或通过环境变量提供。

通过文件：

```powershell
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie
```

通过环境变量：

```powershell
$env:EH_COOKIE = 'ipb_member_id=...; ipb_pass_hash=...'
python tool/fetch_taggroups.py
```

## 常用选项

```powershell
# 测试时仅采集一个分组
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie --show 10

# 忽略缓存，重新抓取
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie --refresh

# 调整请求频率和并发数
python tool/fetch_taggroups.py --cookie-file tool/.eh-cookie --delay 0.5 --workers 2
```

## 输出格式

生成的 `taggroup-data.json` 格式：

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

下载的 HTML 缓存在 `tool/.cache/`，中断后可恢复，避免重复请求。缓存目录和 `.eh-cookie` 均已忽略 Git 提交。

## Excel 导出

安装 `openpyxl` 后可导出为 Excel，每个命名空间一个工作表：

```powershell
python -m pip install openpyxl
python tool/export_taggroups_excel.py
```

生成的 `tool/taggroup-data.xlsx` 每行一个主标签，列为：`小类`、`显示名`、`子类1`、`子类2` 等。
