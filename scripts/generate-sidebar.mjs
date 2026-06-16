#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const docsDir = rootDir
const outputFile = path.join(rootDir, '.vitepress', 'sidebar.generated.mts')

const IGNORE_DIRS = new Set([
  '.git',
  '.vitepress',
  'node_modules',
  '.claude',
  '.idea',
  '.vscode',
  'dist',
  'build'
])

const PREFERRED_SECTION_ORDER = ['android', 'ios', 'ohos', 'tools', 'js', 'kt', 'flutter']

function walkMarkdownFiles(currentDir, baseDir, result) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name.startsWith('.DS_Store')) {
      continue
    }

    const abs = path.join(currentDir, entry.name)
    const rel = path.relative(baseDir, abs).split(path.sep).join('/')

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) {
        continue
      }
      walkMarkdownFiles(abs, baseDir, result)
      continue
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      result.push(rel)
    }
  }
}

function toTitle(raw) {
  const withoutExt = raw.replace(/\.md$/i, '')
  const withoutPrefix = withoutExt.replace(/^\d+[._-]?\s*/, '')
  const normalized = withoutPrefix.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()

  if (!normalized) {
    return 'Untitled'
  }

  return normalized
    .split(' ')
    .map((part) => {
      if (!part) return part
      if (part.length <= 4 && part === part.toUpperCase()) {
        return part
      }
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

function fileLinkFromRel(relPath) {
  const noExt = relPath.replace(/\.md$/i, '')

  if (noExt === 'index') {
    return '/'
  }

  if (noExt.endsWith('/index')) {
    return `/${encodeURI(noExt.slice(0, -('/index'.length)))}/`
  }

  return `/${encodeURI(noExt)}`
}

function createDirNode(name = '') {
  return {
    name,
    dirs: new Map(),
    files: []
  }
}

function insertPath(root, relInsideSection, fullRelPath) {
  const segments = relInsideSection.split('/').filter(Boolean)
  let cursor = root

  if (segments.length === 0) {
    return
  }

  if (segments.length === 1) {
    cursor.files.push(fullRelPath)
    return
  }

  for (let i = 0; i < segments.length - 1; i += 1) {
    const seg = segments[i]
    if (!cursor.dirs.has(seg)) {
      cursor.dirs.set(seg, createDirNode(seg))
    }
    cursor = cursor.dirs.get(seg)
  }

  cursor.files.push(fullRelPath)
}

function splitOrderLabel(value) {
  const m = value.match(/^(\d+)[._-]?(.*)$/)
  if (!m) {
    return { num: Number.MAX_SAFE_INTEGER, text: value.toLowerCase() }
  }
  return { num: Number(m[1]), text: (m[2] || '').toLowerCase() }
}

function compareByNaturalOrder(a, b) {
  const ak = splitOrderLabel(a)
  const bk = splitOrderLabel(b)

  if (ak.num !== bk.num) {
    return ak.num - bk.num
  }

  return ak.text.localeCompare(bk.text, 'en')
}

function nodeToItems(node) {
  const dirEntries = Array.from(node.dirs.entries()).sort((a, b) => compareByNaturalOrder(a[0], b[0]))
  const files = [...node.files].sort(compareByNaturalOrder)

  const dirItems = dirEntries.map(([dirName, dirNode]) => ({
    text: toTitle(dirName),
    collapsed: true,
    items: nodeToItems(dirNode)
  }))

  const fileItems = files.map((relPath) => {
    const fileName = path.posix.basename(relPath)
    return {
      text: toTitle(fileName),
      link: fileLinkFromRel(relPath)
    }
  })

  return [...fileItems, ...dirItems]
}

function stableSectionOrder(sections) {
  const set = new Set(sections)
  const result = []

  for (const preferred of PREFERRED_SECTION_ORDER) {
    if (set.has(preferred)) {
      result.push(preferred)
      set.delete(preferred)
    }
  }

  const remaining = Array.from(set).sort((a, b) => a.localeCompare(b, 'en'))
  return [...result, ...remaining]
}

function buildSidebar(markdownFiles) {
  const rootFiles = []
  const sectionBuckets = new Map()

  for (const relPath of markdownFiles) {
    const parts = relPath.split('/').filter(Boolean)

    if (parts.length === 1) {
      if (parts[0].toLowerCase() !== 'index.md') {
        rootFiles.push(relPath)
      }
      continue
    }

    const section = parts[0]
    if (!sectionBuckets.has(section)) {
      sectionBuckets.set(section, [])
    }
    sectionBuckets.get(section).push(relPath)
  }

  const sidebar = {}

  if (rootFiles.length > 0) {
    sidebar['/'] = [
      {
        text: 'Root',
        collapsed: false,
        items: rootFiles.sort(compareByNaturalOrder).map((relPath) => ({
          text: toTitle(path.posix.basename(relPath)),
          link: fileLinkFromRel(relPath)
        }))
      }
    ]
  }

  for (const section of stableSectionOrder(Array.from(sectionBuckets.keys()))) {
    const tree = createDirNode(section)
    const files = sectionBuckets.get(section) || []

    for (const relPath of files) {
      const relInsideSection = relPath.split('/').slice(1).join('/')
      insertPath(tree, relInsideSection, relPath)
    }

    sidebar[`/${section}/`] = [
      {
        text: toTitle(section),
        collapsed: false,
        items: nodeToItems(tree)
      }
    ]
  }

  return sidebar
}

function writeSidebarFile(sidebar) {
  const content = [
    "import type { DefaultTheme } from 'vitepress'",
    '',
    '// Auto-generated by scripts/generate-sidebar.mjs. Do not edit manually.',
    `// Generated at: ${new Date().toISOString()}`,
    '',
    `export const sidebar: DefaultTheme.Config['sidebar'] = ${JSON.stringify(sidebar, null, 2)}`,
    ''
  ].join('\n')

  fs.writeFileSync(outputFile, content, 'utf8')
}

function main() {
  const markdownFiles = []
  walkMarkdownFiles(docsDir, docsDir, markdownFiles)

  const sidebar = buildSidebar(markdownFiles)
  writeSidebarFile(sidebar)

  const sectionCount = Object.keys(sidebar).length
  console.log(`Generated sidebar with ${markdownFiles.length} markdown files in ${sectionCount} section(s).`)
}

main()
