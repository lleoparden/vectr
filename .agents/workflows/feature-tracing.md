# Feature tracing workflow

Use this before changing a non-trivial feature or diagnosing unexpected
behavior.

1. Describe the affected user action and expected result.
2. Find the relevant UI entry point, document/layer data, persistence path,
   compiler output, and any Supabase boundary.
3. If a Graphify graph exists, start with a focused Graphify query or path.
4. List the files and contracts that must change together, plus the data or
   user work that could be at risk.
5. Add the findings to the feature plan before implementation.
