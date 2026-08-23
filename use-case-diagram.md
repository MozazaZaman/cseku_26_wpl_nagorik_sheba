# Nagorik Sheba — UML Use Case Diagram

## How to view

- Open `use-case-diagram.html` in any browser → high-resolution diagram, Ctrl+P to save as PDF for your report.
- Or paste the PlantUML code below into https://www.plantuml.com/plantuml or https://www.planttext.com

---

## PlantUML Source

```plantuml
@startuml
left to right direction
skinparam actorStyle awesome
skinparam packageStyle rectangle
skinparam usecase {
  BackgroundColor #131a33
  BorderColor #5b8cff
  FontColor #e6ecff
}

actor "Guest\n(no login)" as Guest
actor "Citizen" as Citizen
actor "Authority Staff" as Staff
actor "AI Agent Pipeline" as Agents

rectangle "Nagorik Sheba — Municipal Complaint Management System" {

  ' ---- Public (no authentication) ----
  usecase "Find nearby emergency services\n(fire, police, WASA, LGED,\nDESA, Titas Gas, toilet)" as UC1
  usecase "View service on map /\nemergency call" as UC2
  usecase "Browse & search\ncomplaints" as UC3
  usecase "View complaint details\n& live status" as UC4

  ' ---- Account ----
  usecase "Register account" as UC5
  usecase "Login" as UC6

  ' ---- Citizen ----
  usecase "Submit complaint\n(voice / text / GPS)" as UC7
  usecase "Attach photo\nevidence (optional)" as UC8
  usecase "Set exact GPS\nlocation" as UC9
  usecase "Vote / upvote\ncomplaint" as UC10
  usecase "Track my complaints\n& notifications" as UC11

  ' ---- Agentic pipeline ----
  usecase "Agent-1\nVerify photo & content" as UC12
  usecase "Agent-2\nClassify category" as UC13
  usecase "Agent-3\nDuplicate check → vote" as UC14
  usecase "Agent-4\nCompute priority" as UC15
  usecase "Agent-5\nRoute to authority" as UC16

  ' ---- Staff ----
  usecase "View authority queue\n(category tabs)" as UC17
  usecase "Mark In Process\n(set ETA)" as UC18
  usecase "Mark Resolved\n(done)" as UC19
  usecase "Reject complaint" as UC20
}

' ---- Public associations ----
Guest --> UC1
Guest --> UC3
Guest --> UC5
Citizen --|> Guest

' ---- Citizen associations ----
Citizen --> UC6
Citizen --> UC7
Citizen --> UC10
Citizen --> UC11

' ---- Staff associations ----
Staff --> UC6
Staff --> UC17
UC18 .> UC17 : <<extend>>
UC19 .> UC17 : <<extend>>
UC20 .> UC17 : <<extend>>

' ---- Submit triggers the agent pipeline ----
UC7 .> UC8 : <<extend>>
UC7 .> UC9 : <<include>>
UC7 .> UC12 : <<include>>
UC7 .> UC13 : <<include>>
UC7 .> UC14 : <<include>>
UC7 .> UC15 : <<include>>
UC7 .> UC16 : <<include>>

' ---- Agents execute the pipeline ----
Agents --> UC12
Agents --> UC13
Agents --> UC14
Agents --> UC15
Agents --> UC16

' ---- Emergency map/call extends search ----
UC2 .> UC1 : <<extend>>

note right of UC10
  Voting locked when status = in_process.
  Citizen sees alert:
  "The problem solving is in progress"
end note

note right of UC7
  Precondition: citizen is logged in.
  Duplicate submissions are merged
  into a vote for the original.
end note

note bottom of UC18
  Every status change writes a
  timeline entry and notifies
  the citizen automatically.
end note
@enduml
```

---

## Actor summary

| Actor | Description | Main goal |
|---|---|---|
| **Guest** | Any person using the app without an account | Find emergency services, browse complaints |
| **Citizen** | Registered user (inherits all Guest use cases) | Submit complaints, vote, track progress |
| **Authority Staff** | Employee of a City Corp / Pouroshova / Union Parishad | Process the authority's complaint queue |
| **AI Agent Pipeline** | Internal system actor (Agents 1–5) | Verify, classify, de-duplicate, prioritize, route |

## Key use case descriptions (for your report)

### UC7 — Submit Complaint
| | |
|---|---|
| **Actors** | Citizen (primary), Agent Pipeline (secondary) |
| **Precondition** | Citizen is logged in |
| **Main flow** | 1. Citizen enters title + description (types OR dictates by voice) · 2. Optionally attaches a photo · 3. Pins exact GPS on map · 4. Submits |
| **Agent flow** | Agent-1 verifies content → Agent-2 classifies category → Agent-3 scans 250 m GPS radius → Agent-4 scores priority → Agent-5 routes to matching authority |
| **Alternate flows** | A1: Content fails verification → complaint rejected, citizen notified. A2: Similar active complaint exists nearby → submission merged, counted as a vote on the original. A3: Original already in_process → blocked with alert *"The problem solving is in progress"* |
| **Postcondition** | Complaint stored with status `verified` (or `merged`/`rejected`), routed to an authority, visible in public search |

### UC10 — Vote / Upvote Complaint
| | |
|---|---|
| **Actor** | Citizen |
| **Precondition** | Complaint is `submitted`/`verified`; voter is not the owner; hasn't voted before |
| **Flow** | Citizen searches, opens complaint, taps Upvote → vote stored (UNIQUE per user per complaint), priority rescored by Agent-4, owner notified |
| **Alternate** | Complaint `in_process` → alert *"The problem solving is in progress"*, voting locked |

### UC18/UC19 — Staff labels complaint
| | |
|---|---|
| **Actor** | Authority Staff |
| **Precondition** | Staff logged in; complaint belongs to their authority |
| **Flow** | Open priority-ranked queue (filter by category/status) → Mark *In Process* with ETA hours (or *Resolved* / *Reject*) |
| **Postcondition** | Status + timeline entry saved; citizen receives notification with ETA; complaint locked from further votes/submissions while in process |

### UC1 — Find Nearby Emergency Services (public)
| | |
|---|---|
| **Actor** | Guest (no login required) |
| **Flow** | Browser/device GPS captured → backend returns fire service, police, WASA, LGED, DESA, Titas Gas, public toilets sorted by distance → view on dark map, tap to call |
