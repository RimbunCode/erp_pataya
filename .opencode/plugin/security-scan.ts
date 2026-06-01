import type { Plugin } from "@opencode-ai/plugin"

// Mirrors project .claude/settings.local.json PostToolUse hook for Edit|Write:
//   * semgrep --config=auto on edited file (if installed)
//   * bandit on *.py (if installed)
//   * gitleaks detect on file (if installed)
//   * inline regex scan for hardcoded secrets (password|secret|key|token = "8+chars")
// All scanners are best-effort; failures never block the tool.

const SECRET_RE = /(password|secret|key|token)\s*=\s*["'][^"']{8,}/i

async function has(bin: string, $: any): Promise<boolean> {
  try {
    await $`which ${bin}`.quiet()
    return true
  } catch {
    return false
  }
}

export const SecurityScanPlugin: Plugin = async ({ $ }) => {
  return {
    "tool.execute.after": async (input, output) => {
      const tool = String(input?.tool ?? "").toLowerCase()
      if (tool !== "edit" && tool !== "write") return

      const args = (output as { args?: Record<string, unknown> } | undefined)?.args
      const filePath =
        args && typeof args.filePath === "string" ? args.filePath : ""
      if (!filePath) return

      try {
        if (await has("semgrep", $)) {
          await $`semgrep --config=auto ${filePath}`.quiet().nothrow()
        }
        if (filePath.endsWith(".py") && (await has("bandit", $))) {
          await $`bandit ${filePath}`.quiet().nothrow()
        }
        if (await has("gitleaks", $)) {
          await $`gitleaks detect --source=${filePath} --no-git`
            .quiet()
            .nothrow()
        }
      } catch {
        // ignore
      }

      try {
        const fs = await import("node:fs/promises")
        const content = await fs.readFile(filePath, "utf8")
        if (SECRET_RE.test(content)) {
          console.warn(
            `[security-scan] Potential hardcoded secret detected in ${filePath}`,
          )
        }
      } catch {
        // file missing or binary; ignore
      }
    },
  }
}

export default SecurityScanPlugin
