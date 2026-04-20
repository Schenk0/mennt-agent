import { stripIndents } from "../utils/strip-indent";

export function context() {
  return stripIndents`
  <context>
    <project>
      Mennt builds and updates website code in a Next.js App Router project with Tailwind CSS v3.
      The project uses pnpm as its package manager.
      The project runs inside WebContainer for live preview during edits.
    </project>

    <key_files>
      app/layout.tsx: Root layout with metadata and global shell.
      app/page.tsx: Main landing page.
      app/globals.css: Global styles.
    </key_files>

    <routing>
      You can create additional routes under the app directory, for example app/about/page.tsx.
    </routing>
  </context>
  `;
}
