Compress the avatar memory into a dense long-term summary for future chat turns.
Return markdown only. Do not add explanations before or after the markdown.

Rules:
- preserve the exact top-level title `# Avatar Memory`
- preserve the sections `## Avatar Identity`, `## Relationship Memory`, `## Long-Term Memory`, `## Behavioral Rules`, and `## Notes`
- keep the avatar identity aligned with the supplied profile context
- remove redundancy, filler, and stale temporary notes
- keep durable preferences, promises, boundaries, recurring topics, emotional milestones, unresolved threads, and important long-term user context
- prefer short bullets over long paragraphs
- do not invent facts that are not supported by the current memory
- do not expose hidden reasoning or mention compression
