import { existsSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, extname, resolve, sep } from "node:path"

const appDirectory = dirname(fileURLToPath(import.meta.url))
const distDirectory = resolve(appDirectory, "dist")
const indexFilePath = resolve(distDirectory, "index.html")
const port = Number(process.env.PORT ?? "8080")

const resolveRequestPath = (pathname) => {
  const normalizedPathname = pathname === "/" ? "/index.html" : pathname
  const cleanedPath = normalizedPathname.replace(/^\/+/, "")
  const absolutePath = resolve(distDirectory, cleanedPath)
  const directoryPrefix = `${distDirectory}${sep}`

  if (
    absolutePath !== distDirectory &&
    !absolutePath.startsWith(directoryPrefix)
  ) {
    return null
  }

  return absolutePath
}

const isFilePath = (path) => existsSync(path) && statSync(path).isFile()

Bun.serve({
  port,
  fetch(request) {
    const url = new URL(request.url)
    const assetPath = resolveRequestPath(decodeURIComponent(url.pathname))

    if (assetPath && isFilePath(assetPath)) {
      return new Response(Bun.file(assetPath))
    }

    if (!extname(url.pathname) && isFilePath(indexFilePath)) {
      return new Response(Bun.file(indexFilePath))
    }

    return new Response("Not found", {
      status: 404,
    })
  },
})

console.log(`webui is serving dist at http://0.0.0.0:${port}`)
