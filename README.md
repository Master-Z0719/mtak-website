# MTAK Site

MTAK 产品展示与后台管理系统。  
这是一个基于 **Flask + SQLite + 本地图片上传** 的轻量级站点，适合部署在 **阿里云 ECS** 上长期运行。

项目包含：

- 面向访客的产品展示页
- 面向管理员的后台管理页
- 产品新增 / 编辑 / 删除
- 系列（Series）维护
- 发售方式（Release Method）维护
- 产品图片上传
- 管理员账号登录与修改
- 使用 SQLite 持久化保存数据
- 使用服务器本地目录保存上传图片

---

# 1. 项目定位

本项目适合用于：

- 品牌官网
- 产品展示页
- 限量发售归档页
- 小型后台管理系统
- 不依赖复杂数据库的轻量运营站点

它不是传统电商系统，而是一个更偏 **展示 + 管理** 的品牌产品站点。

---

# 2. 技术栈

- **Backend**: Flask
- **Database**: SQLite
- **Frontend**: HTML / CSS / JavaScript
- **Server**: Waitress / Gunicorn
- **Reverse Proxy**: Nginx
- **Deployment**: 阿里云 ECS

---

# 3. 项目结构

```bash
MTAK/
├─ app.py                  # Flask 主应用
├─ wsgi.py                 # 生产环境入口
├─ index.html              # 前台展示页
├─ admin.html              # 后台管理页
├─ app.js                  # 前端交互逻辑
├─ styles.css              # 样式文件
├─ assets/                 # 静态资源
│  └─ mtak-logo.svg
├─ instance/               # SQLite 数据库与 secret key（运行后生成/维护）
│  ├─ mtak.db
│  └─ secret_key.txt
├─ uploads/                # 产品图片上传目录
├─ requirements.txt        # Python 依赖
├─ render.yaml             # 旧的 Render 配置，可忽略
├─ .gitignore
└─ README.md
```

---

# 4. 站点核心特性

## 4.1 前台展示

- 访客可以浏览全部产品
- 支持产品信息展示
- 支持按发售时间排序
- 支持联名信息展示
- 支持图片展示

## 4.2 后台管理

管理员登录后可以：

- 新增产品
- 编辑产品
- 删除产品
- 上传产品图片
- 维护系列（Series）
- 维护发售方式（Methods）
- 修改管理员账号与密码

## 4.3 数据存储方式

本项目依赖以下两个本地目录：

### 数据库目录

```text
instance/
```

包含：

- `mtak.db`：SQLite 数据库
- `secret_key.txt`：Flask Session 密钥文件

### 图片目录

```text
uploads/
```

包含：

- 后台上传的产品图片

**这两个目录非常重要。**  
如果你误删：

- `instance/mtak.db`：产品数据和管理员数据会丢失
- `instance/secret_key.txt`：会话密钥会变化，登录状态可能失效
- `uploads/`：已上传图片会丢失

---

# 5. 运行逻辑说明

## 5.1 默认访问地址

开发环境启动后：

- 前台：`/`
- 后台：`/admin`

例如：

- `http://127.0.0.1:8000/`
- `http://127.0.0.1:8000/admin`

## 5.2 默认管理员

如果数据库是第一次初始化，系统会自动创建默认管理员：

- 用户名：`admin`
- 密码：`MTAK2026!`

> 首次上线后务必立刻登录后台并修改账号密码。

## 5.3 图片格式限制

仅支持：

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`
- `.gif`

## 5.4 上传大小限制

应用层最大上传限制为：

```text
20 MB
```

Nginx 中也建议同步设置：

```nginx
client_max_body_size 20M;
```

---

# 6. 环境变量说明

项目支持以下环境变量：

| 变量名 | 说明 |
|---|---|
| `PORT` | Flask / Waitress 监听端口，默认 `8000` |
| `MTAK_SECRET_KEY` | Flask Session 密钥，生产环境建议显式设置 |
| `MTAK_ADMIN_USER` | 首次初始化时默认管理员用户名 |
| `MTAK_ADMIN_PASSWORD` | 首次初始化时默认管理员密码 |
| `MTAK_DATA_DIR` | 自定义数据目录，默认是项目根目录 |

## 6.1 很重要的说明

### 关于管理员环境变量

`MTAK_ADMIN_USER` 和 `MTAK_ADMIN_PASSWORD` **只在数据库第一次初始化时生效**。

也就是说：

- 如果 `instance/mtak.db` 还不存在，那么会用环境变量创建默认管理员
- 如果 `instance/mtak.db` 已经存在，那么后续再改环境变量**不会覆盖现有管理员**

### 关于 `MTAK_DATA_DIR`

这个项目支持自定义数据目录，但如果你当前不打算改代码逻辑，**阿里云部署建议先不要设置 `MTAK_DATA_DIR`**，直接使用项目目录下默认的：

- `instance/`
- `uploads/`

这样最稳，维护最简单。

---

# 7. 本地开发运行

## 7.1 安装依赖

```bash
python -m pip install -r requirements.txt
```

## 7.2 启动开发环境

```bash
python app.py
```

## 7.3 打开页面

- 前台：`http://127.0.0.1:8000/`
- 后台：`http://127.0.0.1:8000/admin`

---

# 8. 生产环境推荐架构

阿里云 ECS 推荐使用以下结构：

```text
Nginx  (80/443)
   ↓
Waitress / Gunicorn  (127.0.0.1:8000)
   ↓
Flask App
   ↓
SQLite + uploads
```

推荐原因：

- Nginx 负责外部访问、域名、HTTPS、反向代理
- Flask 应用只监听本机 `127.0.0.1:8000`
- 更安全、更稳定、更适合长期运行

---

# 9. 阿里云 ECS 首次部署（Ubuntu 示例）

> 以下内容默认你用的是 **Ubuntu 22.04 / 24.04**。  
> 如果你用的是 CentOS，命令会略有不同，但整体思路完全一样。

---

## 9.1 连接服务器

在本地终端执行：

```bash
ssh root@你的服务器IP
```

如果不是 root，就把 `root` 换成你的用户名。

---

## 9.2 更新系统并安装基础软件

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv git nginx
```

建议再安装一些常用工具：

```bash
sudo apt install -y curl unzip
```

---

## 9.3 选择项目部署目录

推荐目录：

```bash
/var/www/mtak
```

创建目录：

```bash
sudo mkdir -p /var/www/mtak
sudo chown -R $USER:$USER /var/www/mtak
cd /var/www/mtak
```

---

## 9.4 从 GitHub 拉取项目

### HTTPS 方式

```bash
git clone 你的仓库地址 .
```

### SSH 方式（推荐长期维护）

```bash
git clone git@github.com:你的用户名/你的仓库.git .
```

> 推荐使用 SSH，这样后续服务器 `git pull` 更方便。

---

## 9.5 创建 Python 虚拟环境

```bash
python3 -m venv .venv
source .venv/bin/activate
```

---

## 9.6 安装 Python 依赖

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 9.7 准备运行目录

虽然项目会自动创建目录，但你也可以先手动建好：

```bash
mkdir -p instance uploads
```

---

## 9.8 先手动测试一次应用

```bash
source .venv/bin/activate
python app.py
```

如果看到类似：

```text
Running on http://0.0.0.0:8000
```

说明应用本身没问题。

按：

```bash
Ctrl + C
```

停止测试。

---

# 10. 使用 Waitress 生产运行

本项目已经在 `requirements.txt` 中包含：

- `Flask`
- `waitress`
- `gunicorn`

阿里云部署建议优先用 **Waitress**，更简单直接。

测试运行：

```bash
source .venv/bin/activate
python -m waitress --host 127.0.0.1 --port 8000 wsgi:app
```

如果没有报错，说明生产启动命令正常。

按 `Ctrl + C` 停止。

---

# 11. 配置 systemd 守护进程

为了让站点在后台长期运行，并且在服务器重启后自动启动，建议使用 `systemd`。

---

## 11.1 创建服务文件

```bash
sudo nano /etc/systemd/system/mtak.service
```

粘贴以下内容：

```ini
[Unit]
Description=MTAK Flask Site
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/mtak
Environment="PORT=8000"
Environment="MTAK_SECRET_KEY=请改成你自己的超长随机字符串"
Environment="MTAK_ADMIN_USER=admin"
Environment="MTAK_ADMIN_PASSWORD=请改成你的初始密码"
ExecStart=/var/www/mtak/.venv/bin/python -m waitress --host 127.0.0.1 --port 8000 wsgi:app
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

---

## 11.2 设置目录权限

因为服务是以 `www-data` 用户运行，所以至少要保证这些目录可写：

```bash
sudo chown -R www-data:www-data /var/www/mtak/instance
sudo chown -R www-data:www-data /var/www/mtak/uploads
```

如果你希望整个项目都归 `www-data` 读取，也可以执行：

```bash
sudo chown -R www-data:www-data /var/www/mtak
```

但更常见的做法是：

- 代码目录保持当前用户可维护
- `instance/` 和 `uploads/` 交给 `www-data` 写入

---

## 11.3 启动并设置开机自启

```bash
sudo systemctl daemon-reload
sudo systemctl enable mtak
sudo systemctl start mtak
```

---

## 11.4 查看服务状态

```bash
sudo systemctl status mtak
```

如果状态显示为：

```text
active (running)
```

说明服务正常。

---

## 11.5 查看实时日志

```bash
sudo journalctl -u mtak -f
```

这个命令非常重要，后续排查问题经常会用到。

---

# 12. 配置 Nginx 反向代理

---

## 12.1 创建 Nginx 配置文件

```bash
sudo nano /etc/nginx/sites-available/mtak
```

粘贴以下内容：

```nginx
server {
    listen 80;
    server_name 你的域名 www.你的域名;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

如果你暂时还没有域名，只想先用服务器 IP 测试，可以改成：

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 12.2 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/mtak /etc/nginx/sites-enabled/
```

如果系统里有默认站点，建议先移除：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

---

## 12.3 检查 Nginx 配置

```bash
sudo nginx -t
```

如果显示成功，再重启：

```bash
sudo systemctl restart nginx
```

---

## 12.4 访问测试

此时可以先访问：

- `http://服务器IP/`
- `http://服务器IP/admin`

如果能打开，就说明：

- Flask 正常
- Waitress 正常
- systemd 正常
- Nginx 正常

---

# 13. 阿里云安全组配置

在阿里云控制台中，给 ECS 的安全组放行以下端口：

| 端口 | 用途 |
|---|---|
| `22` | SSH 登录服务器 |
| `80` | HTTP |
| `443` | HTTPS |

## 很重要

**不要把 8000 端口直接对公网开放。**

因为我们已经通过 Nginx 代理到 `127.0.0.1:8000`，外部只需要访问：

- 80
- 443

---

# 14. 绑定域名

如果你要用正式域名访问：

## 14.1 在域名解析里添加 A 记录

把：

- `@`
- `www`

都解析到你的阿里云服务器公网 IP。

例如：

| 主机记录 | 记录类型 | 值 |
|---|---|---|
| `@` | A | 你的服务器公网 IP |
| `www` | A | 你的服务器公网 IP |

---

## 14.2 修改 Nginx 的 `server_name`

把：

```nginx
server_name 你的域名 www.你的域名;
```

改成你的真实域名，例如：

```nginx
server_name mtak.com www.mtak.com;
```

然后执行：

```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

# 15. 配置 HTTPS（推荐）

如果域名已经解析成功，推荐直接申请 SSL 证书。

---

## 15.1 安装 Certbot

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

---

## 15.2 申请证书

```bash
sudo certbot --nginx -d 你的域名 -d www.你的域名
```

例如：

```bash
sudo certbot --nginx -d mtak.com -d www.mtak.com
```

申请成功后，Certbot 会自动帮你修改 Nginx 配置并启用 HTTPS。

---

## 15.3 测试自动续期

```bash
sudo certbot renew --dry-run
```

---

# 16. GitHub 更新后，服务器怎么同步

这是后续维护最常用的操作。

---

## 16.1 本地改完代码后推送到 GitHub

在你本地项目目录执行：

```bash
git add .
git commit -m "update mtak site"
git push origin main
```

如果主分支不是 `main`，就改成你的真实分支名。

---

## 16.2 在服务器拉取最新代码

登录服务器后执行：

```bash
cd /var/www/mtak
git pull origin main
```

---

## 16.3 如果依赖有变化，再更新依赖

```bash
cd /var/www/mtak
source .venv/bin/activate
pip install -r requirements.txt
deactivate
```

---

## 16.4 重启服务

```bash
sudo systemctl restart mtak
```

---

## 16.5 检查是否更新成功

```bash
sudo systemctl status mtak
sudo journalctl -u mtak -n 50 --no-pager
```

---

# 17. 推荐的日常更新流程

每次更新建议按这个顺序来：

1. 本地改代码
2. 本地测试
3. `git add .`
4. `git commit`
5. `git push`
6. 登录阿里云服务器
7. `git pull`
8. 如有需要执行 `pip install -r requirements.txt`
9. `sudo systemctl restart mtak`
10. 浏览器检查前台和后台

---

# 18. 如果你本地已经有数据，怎么迁移到阿里云

如果你本地已经录入了产品，并且图片也上传过，那么上线时不能只传代码，**还要把数据库和图片一起传到服务器**。

需要迁移的目录：

- `instance/`
- `uploads/`

---

## 18.1 先停止服务器上的服务

```bash
sudo systemctl stop mtak
```

---

## 18.2 从本地上传数据到服务器

在你本地终端执行：

```bash
scp -r instance uploads root@你的服务器IP:/var/www/mtak/
```

如果你不是 root，就把用户名换掉。

---

## 18.3 修正权限

回到服务器执行：

```bash
sudo chown -R www-data:www-data /var/www/mtak/instance
sudo chown -R www-data:www-data /var/www/mtak/uploads
```

---

## 18.4 重启服务

```bash
sudo systemctl start mtak
```

---

## 18.5 迁移完成后检查

检查：

- 产品是否都在
- 图片是否都正常显示
- 后台是否能登录
- 原有管理员账号是否还能用

---

# 19. 常见运维命令

---

## 查看服务状态

```bash
sudo systemctl status mtak
```

## 重启服务

```bash
sudo systemctl restart mtak
```

## 停止服务

```bash
sudo systemctl stop mtak
```

## 启动服务

```bash
sudo systemctl start mtak
```

## 查看实时日志

```bash
sudo journalctl -u mtak -f
```

## 查看 Nginx 状态

```bash
sudo systemctl status nginx
```

## 重启 Nginx

```bash
sudo systemctl restart nginx
```

## 检查 Nginx 配置

```bash
sudo nginx -t
```

---

# 20. 备份建议

本项目最重要的备份内容不是代码，而是：

- `instance/mtak.db`
- `instance/secret_key.txt`
- `uploads/`

---

## 20.1 最简单的备份方式

```bash
cp /var/www/mtak/instance/mtak.db /var/www/mtak/instance/mtak.db.bak
```

---

## 20.2 备份数据库与图片目录

```bash
tar -czf mtak-backup-$(date +%F).tar.gz /var/www/mtak/instance /var/www/mtak/uploads
```

---

## 20.3 恢复备份

先停服务：

```bash
sudo systemctl stop mtak
```

恢复文件后再启动：

```bash
sudo systemctl start mtak
```

---

# 21. 常见问题排查

---

## 21.1 页面打不开

先检查：

```bash
sudo systemctl status mtak
sudo systemctl status nginx
```

然后看日志：

```bash
sudo journalctl -u mtak -f
```

---

## 21.2 Nginx 配置错误

执行：

```bash
sudo nginx -t
```

如果报错，先修好配置再重启 Nginx。

---

## 21.3 上传图片失败

检查：

1. 图片格式是否是支持的格式
2. 图片大小是否超过 20MB
3. `uploads/` 是否有写权限
4. Nginx 是否设置了 `client_max_body_size 20M;`

---

## 21.4 后台登录不上

检查：

1. 是否连接到了正确的服务器
2. 是否使用了正确的数据库
3. 是否迁移了 `instance/mtak.db`
4. 是否迁移了 `instance/secret_key.txt`
5. 默认管理员只在首次初始化时创建，后续环境变量不会覆盖已有管理员

---

## 21.5 `git pull` 后网站没变化

常见原因：

1. 你拉的不是正确分支
2. 服务没有重启
3. 浏览器缓存
4. 改动没真正 push 到 GitHub
5. 服务器目录不是当前运行目录

建议执行：

```bash
cd /var/www/mtak
git branch
git log --oneline -n 5
sudo systemctl restart mtak
```

---

## 21.6 更换域名后数据会不会丢

不会。

域名只是访问入口，真正的数据在服务器里：

- 数据库在 `instance/`
- 图片在 `uploads/`

更换域名一般只需要：

1. 修改域名解析
2. 修改 Nginx `server_name`
3. 重新申请或更新 HTTPS 证书

---

# 22. 安全建议

上线前建议至少做到以下几点：

1. 立刻修改默认管理员账号和密码
2. 不要把 `instance/` 和 `uploads/` 提交到 GitHub
3. 不要把 `secret_key.txt` 暴露到公开仓库
4. 不要直接把 8000 端口暴露到公网
5. 使用 Nginx + HTTPS
6. 定期备份数据库和图片目录

---

# 23. `.gitignore` 说明

项目中这些内容不建议提交：

```gitignore
__pycache__/
*.pyc
instance/
uploads/
.env
.venv/
venv/
*.sqlite3
*.db
```

这样做的目的是避免把：

- 本地数据库
- 上传图片
- 虚拟环境
- 密钥文件

提交到仓库里。

---

# 24. 推荐部署目录总结

如果你不想折腾复杂路径，推荐就按下面这套来：

```text
/var/www/mtak
```

项目目录里直接放：

- 代码
- `instance/`
- `uploads/`
- `.venv/`

这样最直观，后续维护也最简单。

---

# 25. 最终推荐上线顺序

建议你第一次上线严格按下面顺序走：

1. 阿里云创建 ECS
2. 开放安全组 `22/80/443`
3. SSH 登录服务器
4. 安装 Python / Git / Nginx
5. 克隆项目到 `/var/www/mtak`
6. 创建虚拟环境并安装依赖
7. 启动一次 `python app.py` 测试
8. 配置 `systemd`
9. 配置 `Nginx`
10. 用服务器 IP 测试站点
11. 迁移本地 `instance/` 与 `uploads/`
12. 绑定域名
13. 配置 HTTPS
14. 登录后台修改默认管理员密码
15. 备份数据库与图片目录

---

# 26. License

This project is for MTAK site development and operations.
