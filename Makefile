.PHONY: help sidebar readme-toc dev build preview clean

# ─── 默认目标 ───────────────────────────────────────────────
.DEFAULT_GOAL := help

# ─── 颜色定义（帮助文档用）──────────────────────────────────
C_RESET   := \033[0m
C_BOLD    := \033[1m
C_YELLOW  := \033[33m
C_CYAN    := \033[36m
C_GREEN   := \033[32m

# ─── 路径 ───────────────────────────────────────────────────
SIDEBAR_SCRIPT    := scripts/generate-sidebar.mjs
README_TOC_SCRIPT := scripts/generate-readme-toc.mjs
SIDEBAR_OUTPUT    := .vitepress/sidebar.generated.mts

# ═════════════════════════════════════════════════════════════
#  帮助文档
# ═════════════════════════════════════════════════════════════
help:
	@echo "$(C_BOLD)$(C_YELLOW)📖 VitePress Blog — Makefile 帮助$(C_RESET)"
	@echo ""
	@echo "$(C_BOLD)可用命令:$(C_RESET)"
	@echo ""
	@echo "  $(C_CYAN)make sidebar$(C_RESET)    生成 VitePress 侧边栏配置"
	@echo "                     扫描全部 markdown 文件,按目录分组,"
	@echo "                     输出到 $(SIDEBAR_OUTPUT)"
	@echo ""
	@echo "  $(C_CYAN)make readme-toc$(C_RESET)  生成 README.md 目录树"
	@echo "                     递归扫描所有 markdown 文件,"
	@echo "                     插入到 README.md ## Contents 区域"
	@echo ""
	@echo "  $(C_CYAN)make dev$(C_RESET)        启动开发服务器 (自动先生成侧边栏)"
	@echo "                     → 等价: sidebar + vitepress dev"
	@echo ""
	@echo "  $(C_CYAN)make build$(C_RESET)      构建生产版本 (自动先生成侧边栏)"
	@echo "                     → 等价: sidebar + vitepress build"
	@echo ""
	@echo "  $(C_CYAN)make preview$(C_RESET)    预览已构建的生产版本"
	@echo "                     → 等价: vitepress preview"
	@echo ""
	@echo "  $(C_CYAN)make clean$(C_RESET)      清理生成的文件"
	@echo "                     → 删除 $(SIDEBAR_OUTPUT) 和 dist/"
	@echo ""
	@echo "  $(C_CYAN)make help$(C_RESET)       显示本帮助 (默认)"
	@echo ""

# ═════════════════════════════════════════════════════════════
#  生成侧边栏
# ═════════════════════════════════════════════════════════════
sidebar:
	@echo "$(C_GREEN)🔍 扫描 markdown 文件并生成侧边栏...$(C_RESET)"
	@node $(SIDEBAR_SCRIPT)

# ═════════════════════════════════════════════════════════════
#  生成 README 目录树
# ═════════════════════════════════════════════════════════════
readme-toc:
	@echo "$(C_GREEN)📋 扫描 markdown 文件并更新 README.md 目录树...$(C_RESET)"
	@node $(README_TOC_SCRIPT)

# ═════════════════════════════════════════════════════════════
#  开发服务器（依赖侧边栏）
# ═════════════════════════════════════════════════════════════
dev: sidebar
	@echo "$(C_GREEN)🚀 启动 VitePress 开发服务器...$(C_RESET)"
	@npx vitepress dev

# ═════════════════════════════════════════════════════════════
#  生产构建（依赖侧边栏）
# ═════════════════════════════════════════════════════════════
build: sidebar
	@echo "$(C_GREEN)📦 构建 VitePress 生产版本...$(C_RESET)"
	@npx vitepress build

# ═════════════════════════════════════════════════════════════
#  预览生产构建
# ═════════════════════════════════════════════════════════════
preview:
	@echo "$(C_GREEN)👀 预览生产构建...$(C_RESET)"
	@npx vitepress preview

# ═════════════════════════════════════════════════════════════
#  清理
# ═════════════════════════════════════════════════════════════
clean:
	@echo "$(C_GREEN)🧹 清理生成文件...$(C_RESET)"
	@rm -rf $(SIDEBAR_OUTPUT) dist .vitepress/dist .vitepress/cache
	@echo "   已删除: $(SIDEBAR_OUTPUT) dist/"
