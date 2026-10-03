# OpenCode System Instructions

## Model: deepseek-v4-pro

### Token-Saving Directives

- **Zero Explanations:** Output ONLY raw code diffs or targeted code segments. Do not explain _why_ code works unless explicitly asked.
- **Incremental Diffs:** Never rewrite an entire file if editing a single method or component template suffices.
- **Lazy Context Loading:** Read only files mentioned in `AI.md` or immediate task boundaries. Do not index the entire node_modules folder.

### Quality Constraints

- Follow clean Angular patterns (Signals or RxJS streams for state).
- Use Tailwind utility classes for UI layouts instead of generating separate massive CSS files.


## Sequencer Upgrade Mission
- **Goal:** Upgrade Loomin from a static 8x8 frequency grid into a dynamic multi-track canvas.
- **Requirements:** Support dynamic musical scales (Major, Minor, Pentatonic), variable grid lengths (8 to 16 steps), and a hardcoded preset playlist system.
- **Architecture Strategy:** Abstract scale pitch mapping formulas and preset track matrix arrays away from templates and into dedicated Angular service streams.