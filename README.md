# top-matches-widget

一个使用 `Vue + Vite + Koa + WebSocket` 的 Top Matches 性能演示项目。

这个仓库现在已经补齐了直接部署到 `Fly.io` 所需的最小文件：

- `Dockerfile`
- `fly.toml`
- 生产环境 `start` 脚本
- `server` 同时托管前端静态资源、REST API、WebSocket

## 本地开发

安装依赖：

```bash
pnpm install
```

启动前后端开发环境：

```bash
pnpm dev:all
```

默认地址：

- 前端：`http://localhost:5175`
- 后端：`http://localhost:8080`
- WebSocket：`ws://localhost:8080/gateway/ws/stream`

## 本地生产验证

先构建前端：

```bash
pnpm build
```

再启动生产服务：

```bash
pnpm start
```

启动后同一个服务会同时提供：

- `/` 前端页面
- `/gateway/api/*` REST API
- `/gateway/ws/stream` WebSocket

## 部署到 Fly.io

### 1. 安装并登录

```bash
brew install flyctl
fly auth login
```

### 2. 初始化应用

如果你还没在 Fly 创建过这个 app：

```bash
fly launch --no-deploy
```

如果本仓库已经有 `fly.toml`，执行后重点确认没有把现有配置覆盖掉。

### 3. 修改 `fly.toml`

当前仓库里的默认配置在 [fly.toml](/Users/ningzheng/pro/top-matches-widget/fly.toml:1)：

```toml
app = "top-matches-widget"
primary_region = "hkg"
```

通常你需要确认这几项：

- `app`
  改成你自己的唯一应用名，比如 `top-matches-widget-ningzheng`
- `primary_region`
  常见可改成离用户更近的区域，比如 `hkg`、`nrt`、`sin`、`sjc`
- `[http_service].internal_port`
  这里必须和服务监听端口一致，当前项目是 `8080`
- `[[vm]].memory_mb`
  当前是 `512`，如果你压测时数据量更大，可以先升到 `1024`
- `min_machines_running`
  现在是 `0`，省钱但冷启动会慢；如果你希望服务一直在线，可以改成 `1`

### 4. 部署

```bash
fly deploy
```

部署完成后可以打开：

```bash
fly open
```

## 常用 Fly 命令

查看应用状态：

```bash
fly status
```

查看日志：

```bash
fly logs
```

查看分配的域名：

```bash
fly ips list
```

SSH 进机器：

```bash
fly ssh console
```

## 部署后常见检查项

### 页面能打开，但数据没出来

先看日志：

```bash
fly logs
```

然后确认这几件事：

- `pnpm build` 是否成功
- `dist/` 是否在镜像构建阶段生成
- `server/index.ts` 是否仍然监听 `PORT`

### WebSocket 连不上

这个项目的 WebSocket 与页面同域部署，不需要额外改前端地址。

如果失败，优先检查：

- Fly 上服务是否正常启动
- 路由是否仍然是 `/gateway/ws/stream`
- 浏览器控制台是否有 101 upgrade 失败或 5xx

### 冷启动慢

这是 `min_machines_running = 0` 的正常现象。

如果你要常驻服务，可以改成：

```toml
[http_service]
  min_machines_running = 1
```

然后重新部署：

```bash
fly deploy
```

## 关于 `dist`

Fly 部署时会在容器里执行构建，所以通常不需要把 `dist/` 提交到 git。

这个仓库已经新增了 `.gitignore` 中的 `dist`。如果你的仓库之前已经跟踪过 `dist`，需要手动把它从 git 索引里移除一次：

```bash
git rm -r --cached dist
git commit -m "stop tracking dist"
```
