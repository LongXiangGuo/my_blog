#!/usr/bin/env node

/**
 * 递归扫描 workspace 中的 markdown 文件，生成带链接的目录树，
 * 插入到 README.md 的 `## Contents` 区域。
 *
 * 用法:
 *   node scripts/generate-readme-toc.mjs
 *   make readme-toc
 */

import fs from 'node:fs'
import path from 'node:path'

// ═══════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════
const ROOT_DIR = process.cwd()
const README_PATH = path.join(ROOT_DIR, 'README.md')
const BASE_URL = '' // 部署时的 base，如 '/my_blog/'；本地预览留空

/** 跳过的目录 */
const IGNORE_DIRS = new Set([
    '.git',
    '.vitepress',
    'node_modules',
    '.claude',
    '.idea',
    '.vscode',
    'dist',
    'build',
    'scripts'            // 脚本目录不展示
])

/** 一级目录排序优先级（排在前面的优先，其余按字母序） */
const SECTION_ORDER = [
    'android',
    'ios',
    'flutter',
    'ohos',
    'ai-agent',
    'llvm',
    'js',
    'todo',
    'tools'
]

/** 根目录下的 md 文件中要跳过的（README 自身、首页 index 等） */
const SKIP_ROOT_FILES = new Set(['readme.md', 'index.md'])

// ═══════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════

/** 从文件名提取展示标题：去数字前缀、去扩展名、分隔符变空格 */
function toTitle(raw) {
    const withoutExt = raw.replace(/\.md$/i, '')
    const withoutPrefix = withoutExt.replace(/^\d+[._-]?\s*/, '')
    const normalized = withoutPrefix.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (!normalized) return 'Untitled'
    return normalized
        .split(' ')
        .map((p) => (p && p.length <= 4 && p === p.toUpperCase() ? p : p.charAt(0).toUpperCase() + p.slice(1)))
        .join(' ')
}

/** 相对路径 → 链接路径 */
function toLink(relPath) {
    const noExt = relPath.replace(/\.md$/i, '')
    if (noExt === 'index') return `${BASE_URL}/`
    if (noExt.endsWith('/index')) return `${BASE_URL}/${encodeURI(noExt.slice(0, -'/index'.length))}/`
    return `${BASE_URL}/${encodeURI(noExt)}`
}

/** 自然排序比较器（按数字前缀 → 字母序） */
function naturalCompare(a, b) {
    const [, aNum, aText] = a.match(/^(\d+)[._-]?(.*)$/) || [, '999999', a]
    const [, bNum, bText] = b.match(/^(\d+)[._-]?(.*)$/) || [, '999999', b]
    const n = Number(aNum) - Number(bNum)
    return n !== 0 ? n : (aText || '').toLowerCase().localeCompare((bText || '').toLowerCase(), 'en')
}

// ═══════════════════════════════════════════════════════════
// 递归扫描
// ═══════════════════════════════════════════════════════════

/**
 * 递归扫描目录，返回树结构:
 *   { name, dirs: Map<string, node>, files: string[] }
 */
function scanDir(currentDir, baseDir) {
    const node = { name: path.basename(currentDir), dirs: new Map(), files: [] }
    let entries
    try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
        return node
    }

    for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue

        const abs = path.join(currentDir, entry.name)

        if (entry.isDirectory()) {
            if (IGNORE_DIRS.has(entry.name)) continue
            const child = scanDir(abs, baseDir)
            // 只保留有内容的目录
            if (child.files.length > 0 || child.dirs.size > 0) {
                node.dirs.set(entry.name, child)
            }
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
            const rel = path.relative(baseDir, abs).split(path.sep).join('/')
            node.files.push(rel)
        }
    }

    return node
}

// ═══════════════════════════════════════════════════════════
// 渲染 Markdown 树
// ═══════════════════════════════════════════════════════════

/**
 * 将节点渲染为 markdown 缩进列表。
 * @param {object} node     树节点
 * @param {string} prefix   当前行前缀（如 "  - "）
 * @param {number}  depth   当前深度
 * @param {boolean} isTop   是否为顶层 section 节点
 */
function renderNode(node, prefix, depth, isTop) {
    const lines = []

    if (isTop) {
        // 一级标题加粗
        lines.push(`- **${toTitle(node.name)}**`)
    } else if (node.name) {
        lines.push(`${prefix}- 📁 **${toTitle(node.name)}**`)
    }

    const childPrefix = isTop ? '  ' : prefix + '  '

    // 先输出子目录，再输出文件
    const sortedDirs = Array.from(node.dirs.entries()).sort((a, b) => naturalCompare(a[0], b[0]))
    for (const [, childNode] of sortedDirs) {
        lines.push(...renderNode(childNode, childPrefix, depth + 1, false))
    }

    const sortedFiles = [...node.files].sort(naturalCompare)
    for (const fileRel of sortedFiles) {
        const fileName = path.posix.basename(fileRel)
        lines.push(`${childPrefix}- [${toTitle(fileName)}](${toLink(fileRel)})`)
    }

    return lines
}

// ═══════════════════════════════════════════════════════════
// 构建整体目录树
// ═══════════════════════════════════════════════════════════

function buildTocLines(allFiles) {
    // 分出根文件 和 各 section 文件
    const rootFiles = []
    const sectionMap = new Map()

    for (const rel of allFiles) {
        const parts = rel.split('/').filter(Boolean)
        if (parts.length === 1) {
            if (!SKIP_ROOT_FILES.has(parts[0].toLowerCase())) {
                rootFiles.push(rel)
            }
            continue
        }
        const section = parts[0]
        if (!sectionMap.has(section)) sectionMap.set(section, [])
        sectionMap.get(section).push(rel)
    }

    const lines = []

    // 根文件
    if (rootFiles.length > 0) {
        lines.push(`- **📄 根目录文件**`)
        for (const rel of rootFiles.sort(naturalCompare)) {
            const fileName = path.posix.basename(rel)
            lines.push(`  - [${toTitle(fileName)}](${toLink(rel)})`)
        }
        lines.push('')
    }

    // 各 section
    const sortedSections = [...sectionMap.keys()].sort((a, b) => {
        const ai = SECTION_ORDER.indexOf(a)
        const bi = SECTION_ORDER.indexOf(b)
        if (ai !== -1 && bi !== -1) return ai - bi
        if (ai !== -1) return -1
        if (bi !== -1) return 1
        return a.localeCompare(b, 'en')
    })

    for (const section of sortedSections) {
        const sectionFiles = sectionMap.get(section)
        // 为每个 section 构建树
        const rootNode = { name: section, dirs: new Map(), files: [] }

        for (const rel of sectionFiles) {
            const inner = rel.split('/').slice(1).join('/')
            const segments = inner.split('/').filter(Boolean)

            if (segments.length === 1) {
                rootNode.files.push(rel)
                continue
            }

            // 嵌套到子目录
            let cursor = rootNode
            for (let i = 0; i < segments.length - 1; i++) {
                const seg = segments[i]
                if (!cursor.dirs.has(seg)) {
                    cursor.dirs.set(seg, { name: seg, dirs: new Map(), files: [] })
                }
                cursor = cursor.dirs.get(seg)
            }
            cursor.files.push(rel)
        }

        lines.push(...renderNode(rootNode, '', 0, true))
        lines.push('')
    }

    return lines
}

// ═══════════════════════════════════════════════════════════
// 插入到 README.md
// ═══════════════════════════════════════════════════════════

function insertIntoReadme(tocLines) {
    const readme = fs.readFileSync(README_PATH, 'utf8')
    const lines = readme.split('\n')

    // 找到 ## Contents 行
    const startIdx = lines.findIndex((l) => /^## Contents\b/i.test(l))
    if (startIdx === -1) {
        console.error('❌ README.md 中未找到 `## Contents` 标题')
        process.exit(1)
    }

    // 找到下一个 ## 行（或者文件末尾）
    let endIdx = lines.length
    for (let i = startIdx + 1; i < lines.length; i++) {
        if (/^##\s/.test(lines[i])) {
            endIdx = i
            break
        }
    }

    // 组装新内容
    const header = [
        `> 以下目录树由 \`scripts/generate-readme-toc.mjs\` 自动生成，请勿手动编辑。`,
        `> 更新命令: \`make readme-toc\` 或 \`node scripts/generate-readme-toc.mjs\``,
        ''
    ]

    const before = lines.slice(0, startIdx + 1).join('\n')
    const after = lines.slice(endIdx).join('\n')
    const newContent = [
        before,
        '',
        ...header,
        ...tocLines,
        after
    ].join('\n')

    fs.writeFileSync(README_PATH, newContent, 'utf8')
}

// ═══════════════════════════════════════════════════════════
// 主流程
// ═══════════════════════════════════════════════════════════

function main() {
    console.log('🔍 扫描 markdown 文件...')
    const allFiles = []
    const rootNode = scanDir(ROOT_DIR, ROOT_DIR)

    // 扁平化收集所有文件
    function flatten(node) {
        for (const rel of node.files) allFiles.push(rel)
        for (const [, child] of node.dirs) flatten(child)
    }
    flatten(rootNode)

    console.log(`   找到 ${allFiles.length} 个 markdown 文件`)

    const tocLines = buildTocLines(allFiles)
    insertIntoReadme(tocLines)

    console.log(`✅ 已更新 README.md 的 ## Contents 区域`)
}

main()
