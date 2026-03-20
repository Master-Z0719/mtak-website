# MTAK Operations Site

这是一个可运营的 MTAK 产品展示后台：

- 访客共享浏览全部产品
- 管理员登录后维护产品、系列、发售方式
- 支持服务器图片上传
- SQLite 持久化保存产品和账号
- 支持联名字段和联名品牌检索

## 目录说明

- `app.py`：Flask 后端
- `wsgi.py`：生产启动入口
- `index.html`：访客页
- `admin.html`：后台页
- `app.js`：前后端交互逻辑
- `styles.css`：样式
- `uploads/`：后台上传的产品图片
- `instance/mtak.db`：SQLite 数据库

## 默认管理员账号

- 账号：`admin`
- 密码：`MTAK2026!`

首次上线后请立刻在后台修改密码。

## 本地启动

1. 安装依赖

```bash
python -m pip install -r requirements.txt
```

2. 开发模式启动

```bash
python app.py
```

3. 打开页面

- 前台：`http://127.0.0.1:8000/`
- 后台：`http://127.0.0.1:8000/admin`

## 生产启动

Windows 或一般服务器可直接用 `waitress`：

```bash
python -m waitress --host 0.0.0.0 --port 8000 wsgi:app

## Render 上线

仓库里已经带了 `render.yaml`，可直接用于 Render 部署。

1. 把项目推到 GitHub
2. 在 Render 里选择 `New +` -> `Blueprint`
3. 连接你的 GitHub 仓库
4. Render 会读取 `render.yaml` 自动创建 Web Service 和持久化磁盘
5. 部署完成后会先得到一个 `onrender.com` 临时网址
6. 再到 Render 的 `Custom Domains` 里绑定你自己的域名

注意：

- 这套站点依赖磁盘保存 `SQLite` 和上传图片，所以必须保留持久化磁盘
- 如果没有持久化磁盘，重启后产品和图片可能丢失
```

## 环境变量

- `MTAK_SECRET_KEY`：建议上线时设置
- `MTAK_ADMIN_USER`：首次初始化时的默认管理员账号
- `MTAK_ADMIN_PASSWORD`：首次初始化时的默认管理员密码

说明：

- 如果数据库 `instance/mtak.db` 已经生成，后续修改默认账号环境变量不会覆盖现有管理员。
- 上传图片保存在 `uploads/`，部署时需要保留这个目录。
