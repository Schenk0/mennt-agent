import { stripIndents } from "../utils/strip-indent";

export function codeGuidelines() {
  return stripIndents`
  <code_guidelines>
    <scope>
      Apply these rules to every file you create or edit.
      Prioritize clean code, reliable UI behavior, and long-term maintainability.
    </scope>

    <react_and_nextjs>
      Use App Router patterns and server components by default.
      Introduce client components only when interactivity is required.
      Keep state minimal and derived when possible.
      Minimize useEffect and only use it for real side effects.
      Do not add unnecessary abstractions or premature architecture.

      Mennt uses Next.js static export (output: 'export') hosted on Cloudflare Pages.
      All pages are pre-rendered at build time — there is no runtime server.

      Never use:
      - Server Actions (not supported in static export)
      - Route Handlers / API routes (no server to handle them)
      - Middleware (not supported in static export)
      - next/image without unoptimized: true
      - Dynamic routes without generateStaticParams()
      - Streaming or Suspense patterns that depend on server data

      For any dynamic routes, always export generateStaticParams() or the build will fail.

      If runtime server logic is needed, flag it explicitly — it must be handled
      via Cloudflare Workers or Pages Functions, not Next.js API routes.
    </react_and_nextjs>

    <html_and_accessibility>
      Use semantic HTML landmarks and meaningful structure.
      Ensure buttons, links, and form controls are keyboard accessible.
      Include alt text for informative images.
      Preserve readable contrast and clear visual hierarchy.
      Make pages responsive using Tailwind breakpoints (sm:, md:, lg:).
    </html_and_accessibility>

    <file_structure>
      Each section of the home page should have its own file in /components/home/ (e.g. hero.tsx, features.tsx, pricing.tsx, etc.)
      Each page should have its own folder in /components with related components in seperate files.
    </file_structure>

    <links_and_interactions>
      Use the next/link component for internal navigation.

      Never create placeholder links or interactions:
      - Do not use href="#" or href="#/"
      - Do not create buttons or links that perform no action
      - Do not simulate interactivity without implementing real behavior
      - Do not add cursor pointer to elements that are not interactive

      Every interactive element must have a clear, functional purpose:
      - Links must navigate to a valid route or external URL
      - Buttons must trigger a meaningful action (navigation, state change, form submission, etc.)

      If a feature or destination is not yet implemented:
      - Do not add a placeholder
      - Instead, implement the feature fully, or omit the element

      If required information is missing to complete an interaction:
      - Do not guess or hardcode assumptions
      - Explicitly request the missing details using the askQuestion tool before proceeding
    </links_and_interactions>

    <content_and_assets>
      Do not use external CDN assets or hotlinked media.
      Prefer local project assets and static-friendly implementations.
      Keep copy concise, specific to the business, and free of filler text.
    </content_and_assets>

    <implementation_quality>
      Keep files focused and modular.
      Choose simple solutions that are easy to read.
      Avoid duplicated logic by extracting small helpers when repetition appears.
      Before finalizing, check that the whole page feels coherent, not section-by-section stitched together.
    </implementation_quality>

    <validation>
      Before finalizing any implementation, always run:
      - pnpm run lint
      - pnpm run typecheck
      If lint/type errors appear, fix them and rerun the checks.
    </validation>
  </code_guidelines>
  `;
}
