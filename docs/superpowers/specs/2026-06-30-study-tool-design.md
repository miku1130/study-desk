# 学习桌面 (StudyDesk) 设计规格

> 状态：已获用户批准（技术栈方案 A，扩展功能全部纳入，资源由用户自备）
> 日期：2026-06-30

## 一、概述

一款运行于 Windows、外观模仿 macOS 的学习辅助桌面工具。目标：功能完备、界面精美。

## 二、技术栈

- 桌面外壳：Electron 33
- 构建：electron-vite 2 + Vite 5
- 前端：Vue 3.5（`<script setup>` + TypeScript）
- 状态：Pinia 2
- 路由：Vue Router 4
- 持久化：自实现 JSON Store（`app.getPath('userData')`），零额外依赖
- 打包：electron-builder 25

## 三、目录结构

```
study/
├── electron.vite.config.ts      # electron-vite 配置
├── package.json
├── tsconfig.*.json
├── resources/                   # 应用图标等（用户自备）
├── src/
│   ├── main/                    # 主进程
│   │   ├── index.ts             # 入口：窗口/IPC/生命周期
│   │   ├── store.ts             # JSON 持久化
│   │   ├── scheduler.ts         # 铃声/课程定时调度（阶段2）
│   │   ├── lockscreen.ts        # 锁屏壁纸窗口（阶段4）
│   │   ├── tray.ts              # 托盘（阶段6）
│   │   └── shortcuts.ts         # 全局热键（阶段6）
│   ├── preload/
│   │   ├── index.ts             # contextBridge 暴露 API
│   │   └── index.d.ts           # window.api 类型
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.ts
│           ├── App.vue          # 外壳布局
│           ├── router/
│           ├── stores/          # Pinia 各模块
│           ├── styles/          # macOS 设计变量 + 主题
│           ├── components/      # 通用组件（交通灯、侧边栏…）
│           ├── views/           # 各功能页面
│           └── composables/     # 组合式逻辑（计时器等）
└── userData/                    # 运行时数据（系统目录，非仓库）
    ├── settings.json
    ├── timetable.json
    └── stats.json
```

## 四、数据模型（核心）

- `Settings`：theme、accentColor、铃声开关、番茄时长、音乐音量、锁屏开关、自启开关、热键映射等
- `Timetable`：作息 `periods[]`（每节起止时间）、课程 `lessons[]`（周几/第几节/课名/教师/地点/颜色）
- `Pomodoro 配置`：workMin、shortBreakMin、longBreakMin、longBreakEvery
- `Stats`：每日番茄完成数、专注分钟数（用于统计图表）
- `Todo`：任务清单项（关联番茄）

## 五、IPC 接口约定（`window.api`）

- `window.*`：minimize / maximize / close / isMaximized
- `config.*`：getAll / set(key,value)（持久化设置）
- `scheduler.*`（阶段2）：上下课铃声调度注册
- `lockscreen.*`（阶段4）：open / close 专注全屏窗口
- `tray.*` / `autostart.*` / `shortcuts.*`（阶段6）

## 六、UI 设计规范（macOS 风）

- 无边框窗口 + 自绘红黄绿交通灯（左上角）
- 系统字体栈、圆角卡片、柔和阴影、半透明侧边栏 + 毛玻璃（backdrop-filter）
- 明暗双主题，跟随系统；强调色可配置
- 侧边栏导航（仪表盘 / 课表 / 番茄钟 / 音乐 / 待办 / 统计 / 设置）
- 流畅过渡动画，悬停反馈

## 七、分阶段路线

0. 脚手架 + macOS 外壳（侧边栏 + 交通灯 + 路由 + 主题）
1. 课表（作息配置、编辑、展示、当前/下节高亮）
2. 上下课铃声（定时调度引擎 + 自定义）
3. 番茄钟（工作/休息循环、配置、统计联动）
4. 番茄锁屏壁纸计时（全屏置顶专注窗口）
5. 背景轻音乐 / 白噪音播放器
6. 扩展（待办、统计图表、通知、托盘、自启、导入导出、热键）
7. 打磨动画 + electron-builder 打包

## 八、资源约定

壁纸、铃声、轻音乐等媒体资源由用户自行放置；软件提供「自定义导入」入口（设置中选择本地文件），并将路径持久化。内置仅提供占位/默认项与目录约定（如 `userData/media/`）。
