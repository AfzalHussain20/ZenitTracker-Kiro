export const BLUEPRINT_DATA = {
    roadmap: [
        {
            title: "Step 1: Environment Setup",
            description: "Install Java JDK, Node.js, and an Intelligent IDE to begin your engineering journey.",
            icon: "MonitorSmartphone",
            details: [
                "Download and install IntelliJ IDEA or VS Code.",
                "Configure system environment variables for JAVA_HOME.",
                "Install Git for version control and collaborative coding."
            ]
        },
        {
            title: "Step 2: Core Foundations",
            description: "Master the basics of web technology and programming logic.",
            icon: "Layers",
            details: [
                "Understand HTML, CSS, and the DOM tree structure.",
                "Learn core Java (OOP, Exceptions, Collections).",
                "Master CSS and XPath selectors for element interaction."
            ]
        },
        {
            title: "Step 3: Framework Specialization",
            description: "Dive deep into Selenium, Playwright, or Cypress based on market needs.",
            icon: "Globe2",
            details: [
                "Learn synchronization patterns and explicit waits.",
                "Implement Page Object Model (POM) for scalability.",
                "Master network interception and API mocking."
            ]
        },
        {
            title: "Step 4: AI-First Automation",
            description: "Integrate Large Language Models and AI Agents into your testing workflow.",
            icon: "BrainCircuit",
            details: [
                "Use Vibium AI for intent-based, selector-less automation.",
                "Leverage AI agents for test data generation and root cause analysis.",
                "Implement MCP (Model Context Protocol) for tool-to-model connectivity."
            ]
        }
    ],
    marketTrends: [
        {
            label: "AI-Driven Testing",
            value: "85%",
            description: "Enterprises adopting AI to reduce test maintenance.",
            growth: "+12.4%"
        },
        {
            label: "Playwright Adoption",
            value: "62%",
            description: "Growth in modern web automation projects.",
            growth: "+18.2%"
        },
        {
            label: "Shift-Left Testing",
            value: "94%",
            description: "Devs and SDETs working closer in the CI/CD pipeline.",
            growth: "+5.1%"
        }
    ],
    setupGuide: {
        steps: [
            {
                title: "Download IntelliJ IDEA",
                action: "Visit JetBrains website and download the Community Edition (Real-world standard).",
                link: "https://www.jetbrains.com/idea/download/"
            },
            {
                title: "Install Java Support",
                action: "Ensure you have JDK 17+ installed. Run 'java -version' in your terminal to verify.",
            },
            {
                title: "Plugin Configuration",
                action: "Install the 'Playwright' or 'Selenium' plugins from the marketplace for syntax highlighting.",
            }
        ]
    },
    aiResources: [
        {
            name: "Perplexity AI",
            use: "Deep research and codebase exploration with real-time web access.",
            link: "https://perplexity.ai",
            dailyHack: "Use it as a 'Reasoning Search' to find complex configuration fixes instead of scrolling StackOverflow."
        },
        {
            name: "Phind",
            use: "Specialized developer search engine for technical documentation and debugging.",
            link: "https://phind.com",
            dailyHack: "Paste a cryptic build error here; it will crawl documentation and give you a one-line fix."
        },
        {
            name: "Hugging Face Chat",
            use: "Access specialized open-source models for test generation without high costs.",
            link: "https://huggingface.co/chat",
            dailyHack: "Use the 'Llama 3' or 'Mistral' models to brainstorm edge cases for your test plans."
        },
        {
            name: "Vercel SDK",
            use: "Implementation guide for connecting AI agents to your automation tools.",
            link: "https://sdk.vercel.ai",
            dailyHack: "The fastest way to build your own custom AI agent that can run your Selenium scripts."
        }
    ],
    modernTrends: [
        {
            title: "The Rise of Agentic AI",
            content: "Automation is moving from 'following steps' to 'achieving goals'. Agents can now self-correct failing tests by analyzing DOM changes."
        },
        {
            title: "MCP Servers",
            content: "Model Context Protocol (MCP) is the new standard for giving AI models secure access to your local tools, files, and databases via standardized JSON-RPC."
        }
    ],
    implementationGuide: [
        {
            tech: "MCP Integration",
            steps: [
                "Clone an MCP server (e.g., filesystem or postgres).",
                "Configure your AI Desktop app (Claude/Cursor) to point to the server executable.",
                "The model can now 'read' your local logs and 'write' fixes directly to your test suite."
            ]
        },
        {
            tech: "AI Agent Connection",
            steps: [
                "Use LangChain or Vercel AI SDK to define a 'Tool' (e.g., executeTest()).",
                "Provide your Selenium scripts as the tool's implementation.",
                "Prompt the agent: 'Test the checkout flow and report any UI deviations'."
            ]
        }
    ],
    graduationGoals: [
        {
            goal: "Master Automation",
            check: "Complete all 5 framework tracks with 100% lab pass rate."
        },
        {
            goal: "AI Architect",
            check: "Implement at least one AI-assisted test using the Vibium framework."
        },
        {
            goal: "Industry Ready",
            check: "Configure a full CI/CD pipeline using the GitHub template provided."
        }
    ],
    businessStrategy: [
        {
            pillar: "Enterprise Scalability",
            description: "SOC2-ready architecture with multi-tenant support for large corporate engineering teams.",
            impact: "Enables Zenit to be the standard training tool for Fortune 500 automation departments."
        },
        {
            pillar: "Global Standardization",
            description: "Catering to IEEE and W3C standards for automated testing and verifiable credentials.",
            impact: "Ensures certificates are recognized as primary credentials in the global job market."
        },
        {
            pillar: "Self-Healing AI Ecosystem",
            description: "Moving from static scripts to AI-native test suites that adapt to UI changes in real-time.",
            impact: "Reduces maintenance cost by 90%, making Zenit the most cost-effective solution for business."
        }
    ],
    enterpriseSpecs: {
        security: ["End-to-end Encryption", "Role-Based Access Control", "Audit Logs"],
        compliance: ["W3C Verifiable Credentials", "OpenID Connect Integration"],
        longevity: ["Blockchain-Based Proof of Completion", "IPFS Storage for Portfolio Continuity"]
    }
};
