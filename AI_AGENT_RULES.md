# AI_AGENT_RULES.md - Deterministic & Production-Grade Guidelines

This file dictates how AI agents should interact with the TRIBE v2 codebase. It leverages principles from Andrej Karpathy's LLM pitfalls, Agent-Skills, and Archon frameworks to ensure deterministic, robust, and clean development.

## 1. Think Before Coding (Karpathy Rule)
- **Don't assume. Surface tradeoffs.** State assumptions explicitly before acting.
- Read existing files before writing code. Do not forge ahead blindly.
- If something is unclear or ambiguous, stop and ask the user.

## 2. Archon-Style Determinism
- **Enforce strict schemas.** When generating JSON, Markdown, or interacting with endpoints, ALWAYS validate against the expected structure.
- Do not invent fields. Do not omit required fields.
- Treat AI code as mission-critical. If it fails parsing once, the flow breaks.

## 3. Surgical & Simple Changes
- **Touch only what you must.** Do not "improve" adjacent formatting or refactor unrelated code.
- Write the minimum amount of code required to solve the task. 
- Avoid speculative flexibility or configurability that wasn't requested.

## 4. Verifiable Execution (Goal-Driven)
- Define a clear goal before starting. Loop until verified.
- Ex: "Update schema -> write test/run endpoint -> verify JSON matches."
- Keep responses concise. Focus on technical accuracy over conversational fluff. No sycophantic openers or closing filler text. 

## 5. Tooling
- Prioritize native tools (`write_to_file`, `replace_file_content`) over writing CLI commands via `run_command` whenever possible.
- Only run external commands when explicitly instructed or absolutely necessary for running servers, installing dependencies, or running complex scripts. 

**USER INSTRUCTIONS ALWAYS OVERRIDE THIS FILE.**
