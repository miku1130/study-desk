# 学习桌面 · StudyDesk

一款运行于 Windows、外观模仿 macOS 的学习辅助桌面工具：课表展示、上下课铃声、番茄钟、番茄锁屏壁纸专注计时、背景轻音乐，以及待办、专注统计等扩展功能。

## 技术栈

- Electron 33 + electron-vite 2 + Vite 5
- Vue 3.5（`<script setup>` + TypeScript）
- Pinia 2（状态） + Vue Router 4（路由）
- 持久化：自实现 JSON Store（写入系统 `userData` 目录）

## 环境要求

- Node.js ≥ 18（开发使用 v24 验证通过）
- npm ≥ 9
- Windows 10/11（云母材质等效果需 Windows 11）

## 安装

```bash
npm install
```

> 国内网络已在项目 `.npmrc` 中配置 npmmirror 镜像（含 Electron 二进制镜像），无需额外操作。

## 运行（开发）

```bash
npm run dev
```

启动后会打开应用窗口，支持热更新。

## 类型检查 / 构建 / 打包

```bash
npm run typecheck     # tsc + vue-tsc 全量类型检查
npm run build         # 构建到 out/
npm run build:win     # 构建并用 electron-builder 打 Windows 安装包
```

## 目录结构

```
src/
  main/        主进程（窗口、IPC、持久化，后续含调度/托盘/锁屏）
  preload/     contextBridge 暴露的安全 API
  renderer/    Vue 应用
    src/
      views/        各功能页面
      components/    通用组件（交通灯、侧边栏…）
      stores/        Pinia 状态
      composables/   组合式逻辑
      styles/        macOS 设计变量与主题
docs/superpowers/specs/   设计规格文档
```

## 故障排查

### Electron 二进制下载失败 / 启动报 "Electron failed to install correctly"

首次安装时 Electron 需额外下载约 110MB 二进制；若从 GitHub 拉取卡住，可用镜像手动补装：

```powershell
$ver = (Get-Content node_modules\electron\package.json | ConvertFrom-Json).version
$url = "https://npmmirror.com/mirrors/electron/$ver/electron-v$ver-win32-x64.zip"
Invoke-WebRequest -Uri $url -OutFile "$env:TEMP\electron-$ver.zip"
Remove-Item node_modules\electron\dist -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive "$env:TEMP\electron-$ver.zip" -DestinationPath node_modules\electron\dist -Force
Set-Content node_modules\electron\path.txt 'electron.exe' -NoNewline
```

## 功能路线图

- [x] 阶段 0：脚手架 + macOS 外壳（交通灯 / 侧边栏 / 路由 / 明暗主题）
- [ ] 阶段 1：课表（作息配置、编辑、展示、当前/下节高亮）
- [ ] 阶段 2：上下课铃声（定时调度 + 自定义）
- [ ] 阶段 3：番茄钟（工作/休息循环、配置、统计联动）
- [ ] 阶段 4：番茄锁屏壁纸专注计时
- [ ] 阶段 5：背景轻音乐 / 白噪音
- [ ] 阶段 6：待办、专注统计、通知、托盘、自启、导入导出、热键
- [ ] 阶段 7：打磨动画 + 打包

> 壁纸、铃声、轻音乐等媒体资源由用户自行放置，软件提供自定义导入入口。
