#!/usr/bin/env node
/**
 * 腾讯云 COS 一键部署脚本
 *
 * 用法：
 *   1. cp .env.cos.example .env.cos 并填入 SecretId / SecretKey
 *   2. npm run docs:build    （生成静态产物到 .vitepress/dist）
 *   3. npm run deploy:cos    （上传到 COS）
 *
 * 功能：
 *   - 递归上传 .vitepress/dist 下所有文件
 *   - 根据扩展名设置正确的 Content-Type（避免浏览器把 js/css 当文本下载）
 *   - 删除远端已失效的旧文件（本地已不存在的 key）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import COS from 'cos-nodejs-sdk-v5'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

// ── 加载 .env.cos ────────────────────────────────────────────
function loadEnv() {
  const p = path.join(rootDir, '.env.cos')
  if (!fs.existsSync(p)) {
    console.error('❌ 缺少 .env.cos 文件')
    console.error('   请先执行: cp .env.cos.example .env.cos')
    console.error('   然后填入你的 SecretId / SecretKey')
    process.exit(1)
  }
  const env = {}
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[k] = v
  }
  return env
}

const env = loadEnv()
const { SECRET_ID, SECRET_KEY, BUCKET, REGION } = env
const DIST_DIR = env.DIST_DIR || '.vitepress/dist'
const KEY_PREFIX = (env.KEY_PREFIX || '').replace(/^\/+|\/+$/g, '')

if (!SECRET_ID || !SECRET_KEY || !BUCKET || !REGION) {
  console.error('❌ .env.cos 配置不完整，请检查 SECRET_ID / SECRET_KEY / BUCKET / REGION')
  process.exit(1)
}

const distDir = path.join(rootDir, DIST_DIR)
if (!fs.existsSync(distDir)) {
  console.error(`❌ 构建产物目录不存在: ${DIST_DIR}`)
  console.error('   请先运行: npm run docs:build')
  process.exit(1)
}

const cos = new COS({ SecretId: SECRET_ID, SecretKey: SECRET_KEY })

// ── 扩展名 → Content-Type ────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
}

function mimeOf(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'
}

// ── 递归收集本地文件 ─────────────────────────────────────────
function walk(dir, base = '') {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.posix.join(base, e.name)
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(full, rel))
    else out.push({ rel, full })
  }
  return out
}

const localFiles = walk(distDir)

// ── 列出远端对象（分页拉全）──────────────────────────────────
function listRemoteKeys() {
  return new Promise((resolve, reject) => {
    const keys = []
    const loop = (marker) => {
      cos.getBucket(
        { Bucket: BUCKET, Region: REGION, Prefix: KEY_PREFIX, Marker: marker, MaxKeys: 1000 },
        (err, data) => {
          if (err) return reject(err)
          for (const o of data.Contents || []) keys.push(o.Key)
          if (data.IsTruncated === 'true') loop(data.NextMarker || keys[keys.length - 1])
          else resolve(keys)
        }
      )
    }
    loop('')
  })
}

// ── 上传单个文件 ─────────────────────────────────────────────
function uploadFile(rel, full) {
  const key = KEY_PREFIX ? `${KEY_PREFIX}/${rel}` : rel
  return new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: key,
        Body: fs.createReadStream(full),
        ContentType: mimeOf(full),
      },
      (err) => (err ? reject(err) : resolve(key))
    )
  })
}

// ── 删除一批对象（deleteMultipleObject 单次上限 1000）────────
function deleteKeys(keys) {
  return new Promise((resolve, reject) => {
    const chunks = []
    for (let i = 0; i < keys.length; i += 1000) chunks.push(keys.slice(i, i + 1000))
    let done = 0
    const next = () => {
      if (done >= chunks.length) return resolve()
      cos.deleteMultipleObject(
        { Bucket: BUCKET, Region: REGION, Objects: chunks[done].map((k) => ({ Key: k })) },
        (err) => {
          if (err) return reject(err)
          done++
          next()
        }
      )
    }
    next()
  })
}

// ── 开启静态网站托管（目录自动映射到 index.html）─────────────
function enableWebsite() {
  return new Promise((resolve, reject) => {
    const websiteConfig = {
      Bucket: BUCKET,
      Region: REGION,
      WebsiteConfiguration: {
        IndexDocument: { Suffix: 'index.html' },
        ErrorDocument: { Key: KEY_PREFIX ? `${KEY_PREFIX}/404.html` : '404.html' },
      },
    }
    cos.putBucketWebsite(websiteConfig, (err) => (err ? reject(err) : resolve()))
  })
}

// ── 主流程 ───────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 开始部署到 COS 桶 ${BUCKET} (${REGION})`)
  console.log(`   本地目录: ${DIST_DIR}（共 ${localFiles.length} 个文件）\n`)

  const remoteKeys = new Set()
  let uploaded = 0
  for (const f of localFiles) {
    const key = await uploadFile(f.rel, f.full)
    remoteKeys.add(key)
    uploaded++
    if (uploaded % 20 === 0 || uploaded === localFiles.length) {
      console.log(`   ↑ 已上传 ${uploaded}/${localFiles.length}`)
    }
  }
  console.log(`✅ 上传完成，共 ${uploaded} 个文件\n`)

  const existing = await listRemoteKeys()
  const stale = existing.filter((k) => !remoteKeys.has(k) && !k.endsWith('/'))
  if (stale.length > 0) {
    console.log(`🧹 发现 ${stale.length} 个远端旧文件，正在删除...`)
    await deleteKeys(stale)
    console.log('✅ 旧文件清理完成\n')
  } else {
    console.log('ℹ️  无需要清理的旧文件\n')
  }

  console.log('� 开启静态网站托管（目录自动映射 index.html）...')
  await enableWebsite()
  console.log('✅ 静态网站托管已开启\n')

  const sitePath = KEY_PREFIX ? `${KEY_PREFIX}/` : ''
  console.log('🎉 部署完成！访问地址:')
  console.log(`   https://${BUCKET}.cos-website.${REGION}.myqcloud.com/${sitePath}\n`)
}

main().catch((err) => {
  console.error('❌ 部署失败:', err.message || err)
  process.exit(1)
})
