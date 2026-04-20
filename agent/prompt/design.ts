import { stripIndents } from "../utils/strip-indent";

export function design() {
  return stripIndents`
  <design_system>
    <preflight>
      Identify business purpose, audience, and desired emotional tone before writing code.
      Commit to one aesthetic direction and keep it consistent across the full page.
      Add distinctive decisions that make the result feel custom, not template-generated.
    </preflight>

    <typography>
      Choose fonts that match the business personality.
      Load Google Fonts via next/font/google in app/layout.tsx.
      Pair heading and body fonts with intentional hierarchy.
      Avoid generic defaults such as Inter, Arial, Roboto, or system-only stacks when a stronger fit is possible.
      Use deliberate sizing, weight, spacing, and line-height.
    </typography>

    <color_and_theme>
      Use a cohesive palette that reflects brand character.
      Apply Tailwind color utilities, arbitrary values, or theme extension when needed.
      Prefer one dominant color with a focused accent instead of flat multi-color distribution.
      Keep strong contrast for readability and accessibility.
    </color_and_theme>

    <layout_and_spacing>
      Use whitespace and rhythm intentionally.
      Avoid repetitive section templates; vary structure and visual weight.
      Use asymmetry, offsets, overlap, or directional flow when they support clarity.
      Keep content scanning easy despite visual creativity.
    </layout_and_spacing>

    <visual_details>
      Use subtle depth with gradients, shadows, textures, or layered surfaces.
      Add polish through transitions and hover states on interactive elements.
      Use decorative accents such as dividers, borders, or motifs with restraint.
    </visual_details>

    <avoid>
      Avoid generic AI-looking hero sections and identical card-grid repetition.
      Avoid cookie-cutter templates with no business-specific character.
      Avoid overused patterns that do not support the content.
      Avoid overusing bagde like elements that are not necessary.
    </avoid>
    
    Each site should feel distinct from previous outputs in theme, layout, typography, and atmosphere.
  </design_system>
  `;
}