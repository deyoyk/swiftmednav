# Permissions (RBAC matrix)

`D` = district-scoped. `own` = caller-owned records.

| Capability | super | district (D) | dispatcher (D) | driver | emt | hospital | citizen |
|---|---|---|---|---|---|---|---|
| Manage users / suspend | ✅ | ✅(D) | — | — | — | — | — |
| View district incidents | ✅ | ✅(D) | ✅(D) | assigned | assigned | notified | own |
| Create incident | ✅ | ✅ | ✅ | — | — | — | ✅ |
| Recommend / propose / approve / reassign | ✅ | ✅(D) | ✅(D) | — | — | — | — |
| Acknowledge + location update | — | — | — | ✅(own assignment) | — | — | — |
| Status advance (onscene→…) | — | — | ✅(D) | ✅(own) | ✅(own) | — | — |
| EMT vitals / notes / handover draft | — | — | — | — | ✅(assigned) | — | — |
| Hospital resources / accept / ack | — | — | — | — | — | ✅(own hospital) | — |
| Fleet CRUD | ✅ | ✅(D) | read | read(own) | — | — | — |
| Simulation control | ✅ | ✅(D) | ✅(D) | — | — | — | — |
| Analytics / CSV | ✅ | ✅(D) | ✅(D) | — | — | ✅(own) | — |
| Audit read | ✅ | ✅(D) | ✅(D limited) | — | — | — | — |

Enforcement: `requireRole()` in every Route Handler + Mongo query scoping by `districtId` + audit on propose/approve/override/status/handover/suspend. Citizen endpoints never expose other callers' PII.
