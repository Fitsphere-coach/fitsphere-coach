*A standard IT approach for selecting the right application
architecture*

# 1. Objective

Establish a consistent, requirement-driven approach for selecting an
application architecture using recognised IT standards, software
engineering principles, and measurable evaluation criteria.

**Core principle:** Architecture must be driven by business
requirements, non-functional requirements (NFRs), security obligations,
and operational constraints—not personal preference, programming
language, or technology trends.

**What not to base the decision on:** Do not choose an architecture
because it is personally preferred, fashionable, widely discussed, or
“the latest” technology; do not adopt microservices, serverless, or
other complex patterns without a demonstrated requirement and a clear
business or technical benefit.

# 2. Recognised references

- **ISO/IEC/IEEE 42010:** Guidance for describing and documenting system
  architecture.

- **ISO/IEC 25010:** A software product quality model to help define and
  evaluate quality characteristics.

- **TOGAF:** An enterprise architecture framework for aligning
  architecture with business goals and governance.

- **NIST SSDF:** A framework for integrating secure development
  practices into the software development lifecycle.

- **C4 model:** A practical way to communicate architecture through
  context, container, component, and code diagrams.

Use the references proportionately to the application’s size, risk, and
regulatory obligations; no single framework prescribes the best
architecture for every application.

# 3. Architecture decision process

1.  **Business requirements:** Identify the purpose, users, business
    processes, and functional requirements.

2.  **Non-functional requirements:** Define measurable expectations for
    security, performance, availability, reliability, maintainability,
    scalability, and recovery.

3.  **Constraints and risks:** Evaluate budget, team skills, technology
    restrictions, integrations, compliance, data sensitivity, and
    hosting requirements.

4.  **Architecture alternatives:** Identify and compare viable
    architecture patterns and technology options.

5.  **Objective evaluation:** Score viable alternatives against weighted
    criteria, using evidence and documented assumptions.

6.  **Decision and documentation:** Select the most suitable option,
    record the rationale and trade-offs, and obtain stakeholder
    approval.

7.  **Validation:** Test high-risk assumptions through prototypes,
    performance tests, security assessments, or integration proofs of
    concept.

# 4. Architecture evaluation criteria

The weights below are an illustrative starting point. Set final weights
based on the application’s requirements, risk profile, and business
priorities.

| Criterion                        | Example weight | Key question                                                         |
|----------------------------------|----------------|----------------------------------------------------------------------|
| Security and compliance          | 20%            | Can the application protect data and satisfy applicable obligations? |
| Maintainability                  | 20%            | Can developers safely understand, test, and modify it?               |
| Reliability and availability     | 15%            | Can it handle failures and meet uptime requirements?                 |
| Performance                      | 15%            | Can it meet expected response times and workloads?                   |
| Scalability                      | 10%            | Can it handle anticipated growth?                                    |
| Development and operational cost | 10%            | Is the total build, deployment, and maintenance cost acceptable?     |
| Integration flexibility          | 10%            | Can it integrate reliably with required external systems?            |
| **TOTAL**                        | **100%**       |                                                                      |

## Weighted scoring method

Weighted Score = Σ \[weightᵢ × (scoreᵢ / 5)\]

Weight is expressed as a percentage and each architecture receives a
score from 1 to 5 for each criterion. The result is a score out of 100.

**Important:** These weights and scores are decision-support tools, not
values prescribed by ISO. Mandatory security, privacy, and regulatory
requirements must be pass/fail gates; a high overall score cannot
compensate for a critical failure.

# 5. Selecting the appropriate architecture pattern

| Pattern                   | Suitable when                                                                                                                   | Main trade-offs                                                               |
|---------------------------|---------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------|
| Layered architecture      | Clear separation between presentation, business logic, and data access is useful.                                               | Layers can become unnecessarily dependent if boundaries are weak.             |
| Modular monolith          | A cohesive application needs clear internal modules and straightforward deployment.                                             | Components deploy together; module boundaries require discipline.             |
| Microservices             | Distinct capabilities need independent deployment, ownership, or scaling, and the organisation can operate distributed systems. | Higher infrastructure, monitoring, communication, and operational complexity. |
| Event-driven architecture | Workloads need asynchronous processing, event notifications, or loose coupling.                                                 | More complex event tracking, failure handling, and consistency.               |
| Serverless architecture   | Managed, event-triggered compute fits the workload and required controls.                                                       | Possible vendor dependency, execution constraints, and cost variability.      |

**Recommended starting point:** Evaluate a modular monolith with clear
architectural layers as an initial candidate—not as a mandatory rule.
Introduce workers, event-driven processing, or microservices when
requirements and evidence justify the added complexity.

# 6. Mandatory components of an architecture design

8.  **System context:** Users, external systems, integrations, and
    application boundaries.

9.  **Logical structure:** Modules, responsibilities, dependencies, and
    separation of concerns.

10. **Data architecture:** Database design, relationships, ownership,
    validation, retention, backup, and migration.

11. **Integration architecture:** APIs, protocols, external
    dependencies, timeouts, retries, and error handling.

12. **Deployment architecture:** Hosting, infrastructure, networking,
    release strategy, and environment configuration.

13. **Security architecture:** Authentication, authorisation, least
    privilege, trust boundaries, encryption, audit trails, and threat
    analysis.

14. **Quality requirements:** Measurable performance, reliability,
    availability, maintainability, scalability, and recovery targets.

15. **Testing strategy:** Unit, integration, end-to-end, security, and
    performance testing as applicable.

16. **Operations and observability:** Logging, monitoring, alerting,
    incident response, backup, and disaster recovery.

17. **Decisions and documentation:** Alternatives, rationale,
    trade-offs, risks, diagrams, API contracts, and Architecture
    Decision Records (ADRs).

# 7. Organisational and financial considerations

- **Team structure and skills:** Choose an architecture the team can
  develop, operate, and support effectively.

- **Total cost of ownership (TCO):** Include development,
  infrastructure, licensing, monitoring, maintenance, training, and
  support.

- **Future change:** Plan for likely business growth without
  overengineering for hypothetical needs.

- **Vendor and technology dependency:** Evaluate portability,
  interoperability, licensing, and exit costs where relevant.

- **Compliance and governance:** Identify applicable legal, regulatory,
  contractual, and organisational controls before implementation.

Conway’s Law is also a useful consideration: system boundaries and
communication patterns should align sensibly with the organisation’s
teams and responsibilities.

# 8. Architecture Decision Record (ADR)

18. Context: What requirement or problem requires a decision?

19. Options considered: Which viable alternatives were evaluated?

20. Decision: Which option was selected?

21. Rationale: What evidence and criteria support the selection?

22. Consequences: What benefits, limitations, costs, and risks follow?

23. Validation: What tests or evidence are needed to confirm the
    decision?

24. Approval and review: Who approved it, and what changes would trigger
    reconsideration?

# 9. Governance and review

Before implementation begins, review the architecture against:

- Business requirements and measurable quality targets.

- Mandatory security, privacy, and compliance requirements.

- Integration constraints, operational readiness, and total cost.

- Documented risks, trade-offs, and validation plans.

- Clear responsibilities for approval and future review.

Reassess the architecture when material changes occur in business
requirements, workload, security risks, compliance obligations, or
operational constraints.

# 10. Final recommendation

Adopt a requirements-driven architecture decision process supported by
measurable quality criteria, structured comparison, risk assessment, and
documented decisions. This provides a repeatable and transparent way to
select an architecture that meets current needs while remaining
maintainable and adaptable.

**The goal is not to select the most advanced architecture;** it is to
select the architecture that best satisfies defined requirements at an
acceptable level of risk and total cost.
