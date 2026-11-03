# Standard IT Rules: Generic Code Practices

Version 1.1 (draft for internal approval) | Reviewed 2026-10-22 | Owner: <name/team>

Generic coding rules for every application and every technology stack. Architecture and testing standards are maintained in separate documents and are not repeated here. Technology-specific rules belong in their own files and never override this one.

## How to read this file

- **MUST** = mandatory. **SHOULD** = default; deviate only with a stated reason. **MAY** = optional, use judgment.
- Source tags: **[S]** supported by an official source (see `standards-sources.md`). **[E]** general engineering practice, not an official vendor requirement. **[O]** proposed organizational standard that needs internal approval before it is called policy.
- No rule sets a numeric limit on function length, nesting depth or file size. If the project defines one, follow the project.
- If rules conflict, the order is: law and security, then the project's existing conventions, then this file. State the conflict instead of choosing silently.
- Follow the stack's official documentation and the project's established conventions where they differ from this file's examples.

## 1. Clean code and readability [E]

- CC-1 MUST name things for what they mean in the business domain. Names SHOULD be consistent with the surrounding code.
- CC-2 SHOULD flatten conditionals when special cases bury the main path: use guard clauses or early returns for exceptional cases, then handle the normal case last. [S: Fowler]
- CC-3 MAY keep nested or if/else logic when both branches are equally normal, or the nesting mirrors the business rule. Do not rewrite working nesting only to reduce indentation.
- CC-4 SHOULD apply single responsibility where it helps: give a function or module one clear reason to change, and split it when you cannot describe it without "and". Do not split cohesive logic only to make pieces smaller.
- CC-5 MUST NOT duplicate business logic. Extract it once it exists in a second place and is meant to change together.
- CC-6 MUST NOT leave unexplained magic values. Use named constants or configuration.
- CC-7 SHOULD prefer the simplest expression that is correct. MUST NOT add abstractions, patterns or extension points for needs nobody has stated.
- CC-8 SHOULD use comments to explain why, constraints and non-obvious decisions. MUST NOT leave commented-out code or comments that restate the code.
- CC-9 SHOULD keep business rules separate from presentation and data access.
- CC-10 MUST follow the formatter and linter the project already uses.
- CC-11 MUST NOT refactor unrelated code in the same change. Report it instead.
- CC-12 MUST NOT introduce circular dependencies or hidden side effects (changing global state, hidden I/O in a getter).

## 2. Validation and business logic [S: OWASP Input Validation]

- VA-1 MUST validate untrusted input at every trust boundary, on the trusted (server) side. Client-side checks are a convenience only.
- VA-2 SHOULD use allow-lists (define what is accepted) over deny-lists.
- VA-3 MUST define behavior for missing, null, empty, malformed, duplicate, oversize and unexpected values, and for boundary values.
- VA-4 MUST enforce business rules in the authoritative layer (the one that owns the data), not only in the UI.
- VA-5 MUST NOT treat validation as the main defense against injection or XSS. Use parameterized queries and context-aware output encoding (SE-4, SE-5).

## 3. Error handling and reliability [S: OWASP Error Handling; E]

- ER-1 MUST handle errors explicitly. MUST NOT swallow exceptions or leave empty catch blocks.
- ER-2 MUST NOT expose stack traces, internal paths, framework versions, queries or secrets to end users. Return a generic message, and record details server-side.
- ER-3 SHOULD use one central error-handling mechanism per application, and a standard error format for APIs where the project has none. [S]
- ER-4 MUST set timeouts on every network, database and external call. Retries MUST be bounded, with backoff. [E]
- ER-5 MUST NOT retry a non-idempotent operation unless duplicate effects are prevented (idempotency key, uniqueness constraint). [E]
- ER-6 MUST release resources (connections, files, locks, handles) on every path, including failure paths.
- ER-7 SHOULD plan for partial failure: define what state remains when step 3 of 5 fails, and make it recoverable or compensable.

## 4. Security and privacy [S: OWASP Secrets Management, SQL Injection Prevention, Input Validation]

- SE-1 MUST NOT hardcode secrets or credentials in source, configuration files, fixtures or images. Use a secrets manager. Environment variables are an acceptable fallback, not the first choice. [S]
- SE-2 MUST NOT print, log or return secrets. If a secret leaks, treat it as compromised and rotate it. [S]
- SE-3 MUST enforce authentication and authorization on the trusted backend for every protected operation, and check object-level access, not just login. MUST apply least privilege to users, services, tokens and database accounts. [S]
- SE-4 MUST access databases through parameterized queries or equivalent safe APIs. When a value cannot be bound (table name, sort direction), map it against a fixed allow-list. MUST NOT build queries by concatenating input. [S]
- SE-5 MUST encode output for its context (HTML, attribute, URL, script, SQL, shell). MUST NOT build shell commands or file paths from raw input.
- SE-6 MUST protect against CSRF for cookie-based sessions, SSRF for server-side fetches of user-supplied URLs, path traversal in file access, and unsafe deserialization of untrusted data. See the OWASP cheat sheets in `standards-sources.md`. [E]
- SE-7 MUST protect personal and sensitive data in logs, errors, URLs and analytics. SHOULD collect and keep only what is needed. [S]
- SE-8 SHOULD review new dependencies for security record, maintenance, license and compatibility (DC-1).
- SE-9 SHOULD run a lightweight threat model (what is protected, who attacks it, how) for features that handle authentication, money, personal data or new external access. [E]

## 5. Database and data integrity [E]

- DB-1 MUST use transactions for multi-step changes that must succeed or fail together.
- DB-2 MUST respect constraints, relationships and uniqueness. MUST NOT work around an integrity constraint in application code.
- DB-3 MUST handle concurrent updates and duplicate requests (optimistic or pessimistic control, unique constraints).
- DB-4 MUST NOT run unbounded queries. SHOULD paginate or batch, select only needed columns, and avoid per-row queries (N+1).
- DB-5 SHOULD add indexes based on observed query patterns and evidence, not guesses.
- DB-6 MUST treat schema migrations and data-changing scripts as controlled changes: reviewed, reversible or with a documented rollback, and never run against production by an assistant.
- DB-7 SHOULD give application database accounts only the permissions they need. [S: OWASP SQL Injection Prevention]

## 6. API and integration design [E]

- AP-1 MUST preserve API contract compatibility unless the requirement changes it. Breaking changes need versioning or a migration plan.
- AP-2 MUST validate responses from external services and handle their unavailability, slow responses and rate limits.
- AP-3 SHOULD paginate list endpoints and apply rate limiting where abuse is possible.
- AP-4 SHOULD make write operations that clients may retry idempotent.
- AP-5 MUST NOT return more data than the caller needs, and MUST NOT expose sensitive fields or internal identifiers without need.
- AP-6 SHOULD secure APIs per OWASP REST Security guidance. [S]

## 7. Performance and scalability [E]

- PF-1 SHOULD avoid N+1 access, repeated expensive computation, unnecessary re-rendering and unbounded loops or result sets.
- PF-2 SHOULD batch and paginate large operations.
- PF-3 MUST NOT optimize on assumption. Optimize against a stated requirement, measurement or credible bottleneck, and record the result.
- PF-4 MAY add caching when measurement justifies it. MUST then define invalidation, expiry and behavior on a cold cache.
- PF-5 SHOULD consider load spikes and downstream limits (connection pools, third-party rate limits) for anything on a hot path.

## 8. Dependencies and configuration [S: 12-Factor Config, OWASP Secrets Management; E]

- DC-1 MUST NOT add a dependency when the standard library or existing dependencies suffice. When adding one, state why, and check maintenance, license and security record.
- DC-2 MUST keep lockfiles consistent and follow existing dependency policy. MUST NOT upgrade unrelated dependencies.
- DC-3 MUST NOT install packages or edit dependency files only to make a check run, unless authorized.
- DC-4 MUST keep configuration that varies by deployment out of code. Development, test and production settings MUST be separate. A useful test: the codebase could be published without leaking credentials. [S]
- DC-5 SHOULD validate required configuration at startup and fail fast with a clear message that does not reveal secret values.

## 9. Logging and observability [S: OWASP Logging; E]

- LG-1 MUST NOT log passwords, tokens, session identifiers, keys, connection strings, payment data or sensitive personal data. Mask or omit them. [S]
- LG-2 SHOULD log security-relevant events: authentication results, authorization failures, validation failures, privilege and configuration changes, and application errors. [S]
- LG-3 MUST sanitize untrusted values before logging them, to prevent log injection. [S]
- LG-4 SHOULD use levels consistently (error for failures needing attention, warn for recoverable problems, info for significant events, debug for diagnostics) and follow the project's scheme. [S]
- LG-5 SHOULD make important failures observable (alerts, metrics) and consider correlation IDs, tracing, health checks and graceful shutdown for services. [E]

## 10. UI and accessibility [E]

- UI-1 SHOULD provide loading, empty, success and error states, and handle slow or failed requests.
- UI-2 SHOULD prevent accidental duplicate submissions (disable on submit, server-side idempotency).
- UI-3 MUST meet the accessibility requirements that apply to the product (for example keyboard use, labels, contrast). Name the standard in the project's own documentation.
- UI-4 MUST keep server-side validation and authorization (VA-1, SE-3). Hiding a control in the UI is not access control.

## 11. Concurrency and asynchronous work [E]

- CO-1 MUST protect shared mutable state, or avoid sharing it.
- CO-2 MUST support cancellation and timeouts for long or external operations, and clean up on cancel.
- CO-3 MUST NOT create unbounded tasks, threads or queues. Bound concurrency and apply backpressure.
- CO-4 MUST acquire locks in a consistent order and hold them briefly, to avoid deadlock.
- CO-5 MUST NOT repeat an irreversible operation on retry (ER-5).

## 12. Documentation and change management [E]

- CM-1 MUST update documentation, API contracts and examples affected by the change.
- CM-2 SHOULD keep each change focused and reviewable. MUST NOT mix unrelated changes.
- CM-3 MUST review the final diff for unintended changes, secrets, debug code, leftover TODOs and generated noise before reporting done.
- CM-4 SHOULD note breaking changes, deployment order, rollback and migration implications.
- CM-5 MUST preserve existing user changes. MUST NOT overwrite, revert or reformat work you did not make for this task.
