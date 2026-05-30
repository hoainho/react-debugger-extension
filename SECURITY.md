# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.x     | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in react-debugger-extension, please report it privately to:

**hoainho.work@gmail.com**

Please include:

- A description of the vulnerability
- Steps to reproduce
- Affected versions
- Any potential impact you've identified
- Suggested fix if you have one

## Disclosure Timeline

We follow a 90-day coordinated disclosure policy:

1. **Day 0**: Report received, we acknowledge within 72 hours.
2. **Day 1-30**: We investigate, validate, and develop a fix.
3. **Day 30-60**: We test the fix and prepare a release.
4. **Day 60-90**: Release the fix; public disclosure after users have had time to upgrade.
5. **Day 90+**: Public disclosure with credit to the reporter (unless you prefer to remain anonymous).

If the issue is actively exploited in the wild, we may accelerate this timeline.

## Scope

Security issues we will investigate:

- Arbitrary code execution in the extension or injected content scripts
- Information disclosure (page DOM, Redux state, API responses, subscription keys)
- Authentication / subscription-key bypass
- Cross-site scripting (XSS) in the DevTools panel UI
- Cross-Site WebSocket Hijacking (CSWSH) in any future MCP bridge work
- Privilege escalation between extension contexts (page world → content → background)

## Out of Scope

- Vulnerabilities in dependencies that don't affect us (report those upstream)
- Issues that require the user to install a malicious extension alongside ours
- Social engineering attacks
- Physical attacks
- Issues in services we link to but don't control (e.g., third-party AI provider APIs)

## Recognition

Security researchers who report valid vulnerabilities will be credited in our CHANGELOG.md release notes (with permission). We don't currently offer monetary bounties.
