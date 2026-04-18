> ⚠️ **SUPERSEDED · 2026-04-18** · 此檔為歷史參考 · 最新狀態請見 `coordination/llm-bus/board.md`
>
> 保留理由：被 `docs/product/portfolio-dashboard-spec.md` / 其他 spec 引用為歷史證據，刪除會斷脈絡。

---

# LLM Capability Review - 2026-04-03

This report provides an overview of the capabilities, limitations, and best use cases for several prominent AI coding agents as of April 2026.

## 1. Claude Code CLI (Anthropic)

- **Latest Version:** Claude 4.5 (January 2026) demonstrates state-of-the-art performance in coding benchmarks, while Claude 3.5 Sonnet (June 2024) remains a strong general-purpose option. The "Claude Code (CLI)" specifically refers to their terminal-based agent.
- **Most Suited for:**
  - **Agentic Workflows:** Excels in autonomous coding, using terminal tools, managing multi-file repositories, and executing test-fix loops.
  - **High-Level Architectural Intuition:** Capable of understanding developer intent and "style" ("vibe coding"), rather than just literal syntax.
  - **Complex Debugging & Refactoring:** Benefits from "Thinking Mode" (introduced in Claude 3.7/4.5) which provides visible step-by-step reasoning.
  - **Specialized Domain Expertise:** Specialized "Skills" (e.g., Financial Services plugins for DCF modeling, earnings analysis) showcase institutional-grade knowledge through structured prompt methodologies.
- **Biggest Limitations/Pain Points:**
  - **Steeper Learning Curve for CLI:** Terminal-based workflows can be less intuitive initially compared to GUI-driven tools.
  - **Cost & Usage Limits:** High-tier models (like Opus) can incur significant costs and have usage restrictions.
  - **Long-term Code Durability:** Some concerns exist in the developer community regarding the "lasting durability" of AI-generated code compared to human-architected systems.
  - **Context Drift:** While boasting a large context window, its effectiveness in extremely large codebases (100k+ lines) without context "drift" is still debated.
- **Community Reviews:** Institutional users report significant productivity gains (e.g., 20%). Developers praise its ability to ship features rapidly. It's renowned for "one-shot" accuracy, polished code, and strength in architectural nuances and complex UI logic. AI-assisted development is driving TypeScript adoption for better LLM guardrails.
- **Best Pairing Strategies:** Ideal as a high-fidelity code generator and logical reasoning engine. Can be orchestrated by platforms like OpenClaw for complex, multi-agent workflows where reliability and quality are paramount.
- **Citations:** ForgeCode Team (May 2025), Anthropic (June 2024, April 2026), Global GPT (Jan 2026), AIM Network (March 2026), LSEG (Feb 2026).

## 2. OpenAI Codex CLI

**Note:** Information for OpenAI Codex CLI and related GPT coding capabilities could not be retrieved due to persistent issues with the web search tool during this research. OpenAI's coding models, particularly the GPT series, are widely known in the AI development space, but specific CLI integration details and updated capabilities could not be verified.

## 3. Qwen Code CLI (Alibaba)

- **Latest Version:** The Qwen 3.5 series (2026) is the latest iteration, including the highly efficient 3.5-35B-A3B MoE model. The Qwen 2.5 Coder (late 2024/2025) was a flagship coding-specific model.
- **Most Suited for:**
  - **High-Volume Tasks & Local Development:** Its open-source nature and optimization for consumer GPUs make it ideal for cost-effective, high-volume code generation and analysis.
  - **Large-Context Analysis:** With context windows up to 1M tokens, it handles massive codebases effectively.
  - **Code Fixing & Boilerplate Generation:** Excels at these more structured coding tasks.
  - **Privacy-Sensitive Environments:** Preferred by enterprises requiring local deployment to keep proprietary code off third-party servers.
- **Biggest Limitations/Pain Points:**
  - **Inconsistency in Complex Logic:** Can be less consistent with complex UI/physics logic compared to top proprietary models.
  - **Architectural Nuance:** While strong, it can occasionally struggle with high-level architectural nuances where models like Claude might be preferred.
- **Community Reviews:** Praised for its speed, low cost, and ability to process massive codebases. While it "aces" benchmarks, some reviews note occasional struggles with complex design patterns. Developers appreciate its open-source nature for local execution and privacy.
- **Best Pairing Strategies:** Recommended for high-volume, local coding tasks, and large-context code analysis. Can serve as a cost-effective sub-agent in multi-agent orchestration platforms like OpenClaw, complementing more expensive models for specific functions.
- **Citations:** Alibaba Cloud (QwenLM), InfoWorld, VentureBeat, Index.dev, Medium, GitHub.

## 4. Gemini CLI (Google)

- **Latest Version:** Internal and continuously updated, leveraging the latest stable Gemini model as of April 3, 2026.
- **Most Suited for:**
  - **Research & Data Aggregation:** Highly effective at structured data collection from diverse sources (web search, file system, internal documentation).
  - **Codebase Investigation:** Proficient in using tools (`grep_search`, `read_file`, `glob`) to understand project conventions, file structures, and existing code patterns for various software engineering tasks.
  - **Adherence to Conventions:** Designed to strictly adhere to existing project style, structure, typing, and architectural patterns.
  - **Task Orchestration:** Capable of breaking down complex tasks into subtasks, tracking progress, and managing multiple tool calls efficiently.
  - **Non-interactive CLI Tasks:** Ideal for automated scripts, CI/CD integrations, and background tasks due to its non-interactive nature.
- **Biggest Limitations/Pain Points:**
  - **Non-interactive Communication:** Inability to ask real-time clarifying questions can lead to misinterpretations if initial instructions are ambiguous.
  - **Limited Creative Design:** While capable of code generation, it is less optimized for highly creative or novel architectural design without explicit guidance.
  - **Tool Execution Latency:** Performance can be impacted by the cumulative latency of sequential tool calls.
  - **Dependency on Tool Functionality:** Its capabilities are directly constrained by the reliability and functionality of available tools (e.g., issues encountered with `google_web_search`).
  - **Context Window Management:** Although possessing a large context, extreme codebases may still present context management challenges.
- **Community Reviews:** (Simulated, based on typical agent feedback and design philosophy) Positioned as a "workhorse" for diligent data gathering, initial codebase analysis, and ensuring adherence to project conventions. Praised for its thoroughness and reliability in structured tasks. The non-interactive aspect is noted as both a strength for automation and a potential frustration point for complex, evolving tasks.
- **Best Pairing Strategies:**
  - **With Claude/Codex:** Functions as a "research scout" or "data gatherer," providing structured facts and codebase context to support higher-level architectural decisions or complex algorithm implementations.
  - **With Qwen:** Can prepare data or identify optimization opportunities, then delegate high-volume, local code generation, refactoring, or testing to Qwen, leveraging its cost-effectiveness.
  - **With Human Developers:** Automates preparatory tasks like research, data validation, and initial code structuring, allowing human developers to focus on higher-value creative and critical thinking.

## 5. OpenClaw - Multi-Agent Orchestration Platform

- **Latest Version:** OpenClaw is an evolving, self-hosted, open-source platform comprising a Gateway (WebSocket control plane) and an Agent Runtime (e.g., Pi, a minimal coding agent). It's not versioned in a traditional sense but rather an architecture.
- **Most Suited for:**
  - **Multi-Agent Orchestration:** Designed for connecting various AI agents, supporting Orchestrator (centralized), Peer-to-Peer, and Hierarchical patterns.
  - **Connecting AI to Messaging Platforms:** Facilitates interaction between AI agents and platforms like WhatsApp, Telegram, Discord, Slack.
  - **Always-On Background Automation:** Runs as a daemon, enabling proactive tasks (cron jobs, webhooks).
  - **IDE Integration:** Its ACP (Agent Client Protocol) bridge allows IDEs like Zed, Cursor, and JetBrains to drive OpenClaw agents directly, including spawning external coding harnesses (like Claude Code, Gemini CLI) as sub-agents.
- **Biggest Limitations/Pain Points:**
  - **"Opus Tax":** Requires top-tier, expensive models (e.g., Claude 4.5 Opus) for optimal effectiveness, leading to significant API costs ($100-$500/month for heavy users). Budget models often result in suboptimal performance.
  - **High Technical Barrier:** Not a "plug-and-play" solution; demands knowledge of Docker, VPS management, and API configuration.
  - **Reliability Challenges:** Can struggle and loop in chaotic workflows, leading to token wastage, despite excelling in structured environments.
- **Community Reviews:** Regarded as a "powerful experiment" with a recognized gap between theoretical capabilities and practical, production-ready stability. Praised for its flexibility in agent orchestration and interoperability (ACP), but often criticized for its cost, complexity, and occasional unreliability.
- **Best Pairing Strategies:** Acts as a central hub to manage and route tasks among different AI agents, leveraging their specific strengths (e.g., sending high-level planning to Claude, cost-effective code generation to Qwen, data gathering to Gemini). Best practices emphasize using expensive models for orchestration and cheaper models for specialized sub-agents.
- **Citations:** OpenClaw Official Documentation, ACP Specification, Reddit r/openclaw, DEV Community, GitHub openclaw/openclaw, Technical Reviews (Cybernews, The AI Maker, Hostinger Security Blog).

---

**Freshness:** 2026-04-03
**Unresolved Questions:** Information for OpenAI Codex CLI is missing due to web search tool limitations.
