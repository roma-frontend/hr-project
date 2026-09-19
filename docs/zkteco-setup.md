# Connecting an attendance terminal (ZKTeco ADMS)

An attendance terminal should push its own punches. This document covers pointing
a ZKTeco device at the deployment so it does that without a middleware PC, plus
what to do when the device is a Suprema.

- Endpoint mount point: `/iclock` (`ZK_SERVER_PATH` in `convex/lib/zkteco.ts`)
- Protocol layer: `convex/lib/zkteco.ts` (pure, unit-tested)
- HTTP routes: `convex/http.ts`
- Review queue: Settings → Integrations → Inbound

---

## What the terminal must support

Stated as capabilities rather than a model list. Firmware menus differ even
within one product family, so the reliable check is your own device's menu — it
takes about ten seconds.

| Capability                                      | Why it is required                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Push / ADMS / Cloud Server mode in the firmware | The **device** opens the connection. A terminal that only works with ZKAccess on a local PC cannot reach a hosted service. |
| A configurable server address **and path**      | Not just a LAN IP: the terminal has to reach a public host over HTTPS, or HTTP on a fixed address.                         |
| A readable serial number                        | The serial **is** the credential — it binds the device to your organisation.                                               |

If all three are present, the endpoint will accept the device.

**We do not publish a certified model list.** A compatibility matrix nobody has
tested against real hardware is a promise with no evidence behind it. The guide
in the app says the same thing, deliberately.

---

## Setup, in order

Order matters: a device pointed at this deployment before a token exists is
answered but ignored, by design. An unauthenticated device must not be able to
write punches.

1. **Create an inbound token** for an attendance terminal (Settings →
   Integrations → Inbound → provider _attendance terminal_). The token URL is
   shown once; it is only needed if you also want the generic webhook.
2. **Read the serial number** off the terminal: _Menu → Comm → Ethernet / Cloud
   Server_, or the sticker on the back. Serials are compared case-insensitively.
3. **Bind that serial to the token** in the field next to it. Until a serial is
   bound, punches are stored but attributed to nobody.
4. **Point the terminal at this deployment**:
   - Server address: the deployment host (the app shows the exact value)
   - Path: `/iclock`
   - Port: `443` when the menu offers it, connection mode TCP/HTTPS
5. **Set the device clock and time zone.** Punch times arrive as the device's
   local wall clock and are resolved against **UTC+4** (Armenia). The handshake
   tells the device `TimeZone=4`; a terminal still on a factory default will file
   every punch at the wrong hour. Time zone cannot fix a wrong clock.
6. **Confirm the first punches.** They land in the review list. Nothing reaches
   attendance until an HR user confirms it — a mistyped staff number or a bad
   clock must not move payroll.

### Handshake settings the device receives

| Setting          | Value | Note                                         |
| ---------------- | ----- | -------------------------------------------- |
| Time zone        | UTC+4 | `TimeZone=4`                                 |
| Polling interval | 10s   | `Delay=10`, `TransInterval=1`                |
| Real-time push   | on    | `Realtime=1` — punches arrive as they happen |
| Biometric upload | off   | `TransFlag` keeps templates on the device    |

---

## Menu labels to look for

| Family                                              | Typical menu path                                        | Endpoint            |
| --------------------------------------------------- | -------------------------------------------------------- | ------------------- |
| Face terminals (SpeedFace / FaceDepot class)        | `Comm → Cloud Server`, `Comm → ADMS`, `Comm → Webserver` | `/iclock`           |
| Fingerprint / badge terminals (K-series, MB-series) | `Comm → Ethernet → Cloud Server`, `Comm → ADMS`          | `/iclock`           |
| Suprema BioStar                                     | `BioStar 2 → Device → Server`, `BioStar 2 → Push`        | **generic webhook** |

### Suprema is not ADMS

BioStar pushes its own message format. Sending it to `/iclock` would mean feeding
a real device's payloads to a parser that cannot read them, so use the **generic
webhook** token instead: the shared ingestion path already maps its field
spellings (`PIN` / `emp_code` / `employeeNumber`).

---

## Protocol reference

A ZKTeco terminal speaks ADMS on its own once configured:

| Request                                       | Purpose                                   |
| --------------------------------------------- | ----------------------------------------- |
| `GET /iclock/cdata?SN=<serial>&options=all`   | Handshake; device expects the config text |
| `POST /iclock/cdata?SN=<serial>&table=ATTLOG` | Tab-separated punch batch                 |
| `GET /iclock/getrequest?SN=<serial>`          | Device polls for commands                 |
| `POST /iclock/devicecmd?SN=<serial>`          | Results of those commands                 |
| `GET /iclock/ping`                            | Liveness                                  |

`table=ATTLOG` bodies are positional, one record per line:

```
PIN \t datetime \t status \t verify \t workcode \t …
1   2026-09-18 09:01:22  0   1   -   0
```

`status` is the punch state: `0` = check-in, `1` = check-out. Anything else
(break states 2–5, `255`, or a blank column) is recorded as `unknown` rather than
guessed at — the review queue is where a human decides. An empty status must never
be read as a check-in; there is a regression test for exactly that.

Other tables a device may push (`OPERLOG`, `ATTPHOTO`, `USERINFO`,
`FINGERTMP`) are acknowledged with `OK` and not ingested. Acknowledging matters:
anything else makes the terminal retry the same batch forever.

---

## Troubleshooting

| Symptom                                   | Likely cause                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Nothing arrives at all                    | Device cannot reach the host, or push mode is disabled. Check the terminal's connection log first. |
| Requests arrive, punches list stays empty | No serial is bound to the token, so punches cannot be attributed.                                  |
| Punches are hours off                     | Device clock, or a terminal left on a non-UTC+4 time zone.                                         |
| Punches appear as `unknown` direction     | Firmware sends a break state or an empty status column. Review and import manually.                |
| The same batch keeps repeating            | The device is not receiving `OK:` — usually a proxy rewriting the response body.                   |
