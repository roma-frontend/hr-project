# Biometric data policy (Face ID)

> Face ID stores a **face descriptor** and the enrolment **photo**. That is
> biometric data: special category under GDPR Art. 9, and restricted personal
> data under Armenian law. This is the policy behind the code, and the code now
> enforces it — see `convex/lib/biometricConsent.ts`.

## What is stored, and where

| Data                          | Field                                                    | Store                               |
| ----------------------------- | -------------------------------------------------------- | ----------------------------------- |
| 128-dimension face descriptor | `users.faceDescriptor`                                   | Convex                              |
| Enrolment photo               | `users.faceImageUrl`                                     | **Cloudinary** (US, vendor-managed) |
| Enrolment timestamp           | `users.faceRegisteredAt`                                 | Convex                              |
| Consent record                | `consentRecords` where `consentType = biometric_face_id` | Convex                              |

The descriptor is compared server-side (`/api/auth/face-login` → one-time
`faceLoginTokens`); the matching never happens in the browser and the descriptor
is only returned to its owner (a superadmin reading it through the audited `getFaceDescriptor` path is the one exception).

## Consent

- **Explicit, at enrolment, by the subject.** The checkbox in
  `FaceRegistration.tsx` gates both the camera and the capture button, and
  `registerFace` **refuses without `consentGranted: true`** — the server does
  not rely on the UI hiding a button.
- **Versioned.** The enrolment text has a version
  (`BIOMETRIC_CONSENT_VERSION`, currently `2026-09-20`) stored with the record,
  so an old consent stays traceable to the wording that was actually shown.
- **Self-enrolment only.** An administrator cannot enrol a face for somebody
  else (`Cannot register Face ID for another user`); a superadmin acting through
  the audited impersonation flow is the sole exception.
- **Withdrawable as easily as given.** Removing Face ID in Settings → Security
  (`removeFaceRegistration`) deletes the descriptor and photo **and withdraws
  the consent record** in the same transaction.

## Retention

| Event                       | What happens                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| User removes Face ID        | Descriptor, photo, timestamp cleared; consent withdrawn                                                     |
| Employment ends             | `offboarding.completeProgram` erases descriptor/photo and withdraws consent when the account is deactivated |
| Account has no organization | Enrolment is refused — there is no basis for holding the data                                               |

There is no "keep it just in case" window. A deactivated account has no login, so
nothing needs its face, and retention without a purpose is exactly what Art. 9
prohibits.

## Sub-processor exposure

The enrolment photo is uploaded to **Cloudinary**, a US vendor. That is the
weakest point in this chain and it is stated here rather than buried: a customer
with an Armenia/EU-only residency requirement cannot be served the current
configuration without moving face images to an EU/AM-hosted store or dropping
the photo entirely (the descriptor alone is sufficient for matching).

## Data-subject rights

| Right             | How it is served                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Access            | `getFaceDescriptor` returns the caller's own descriptor/photo; the GDPR toolkit exports `consentRecords` |
| Object / withdraw | Remove Face ID in Settings; or the `consent_withdrawal` GDPR request                                     |
| Erasure           | Remove Face ID, or offboarding erasure, or a `data_deletion` request                                     |
| Rectification     | Re-enrol (remove, then register again)                                                                   |

## Open items — not closed by this policy

- **No consent text review by a lawyer** has happened. The wording is written to
  be honest and specific; it is not a legal opinion.
- **Cloudinary residency** (above) is unresolved for AM/EU-only customers.
- **A signed DPA with Cloudinary** is not collected — see
  `docs/vendor-register.md`.
- **Terminal biometrics** (ZKTeco/Suprema fingerprint devices) are stored **on
  the device**, not in this system: we receive attendance punches, not templates.
  The customer is the controller for those devices and needs its own notice; we
  should hand them a template rather than imply their obligations are ours.
