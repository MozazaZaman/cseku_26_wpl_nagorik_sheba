# Nagorik Sheba — Entity Relationship (ER) Diagram

> An Agentic Web & Mobile Platform for Transparent Municipal Complaint Management with Citizen Participation

## How to view

- Open `er-diagram.html` in any browser → renders a high-resolution diagram you can screenshot/print for your report.
- Or paste the Mermaid code below into https://mermaid.live

---

## Entities & Attributes

### 1. USER (Citizen)
| Attribute | Type | Constraints | Description |
|---|---|---|---|
| user_id | INTEGER | **PK**, AUTOINCREMENT | Unique citizen ID |
| full_name | TEXT | NOT NULL | Citizen's name |
| email | TEXT | NOT NULL, **UNIQUE** | Login identifier |
| phone | TEXT | | Contact number |
| password_hash | TEXT | NOT NULL | Hashed password |
| role | TEXT | NOT NULL, DEFAULT 'citizen' | `citizen` / `staff` |
| created_at | DATETIME | DEFAULT now | Registration date |

### 2. AUTHORITY (City Corporation / Pouroshova / Union Parishad)
| Attribute | Type | Constraints | Description |
|---|---|---|---|
| authority_id | INTEGER | **PK** | Unique authority ID |
| name | TEXT | NOT NULL | e.g. "Dhaka South City Corporation" |
| type | TEXT | NOT NULL | `CITY_CORPORATION` / `POUROSHOVA` / `UNION_PARISHAD` |
| min_lat, max_lat, min_lng, max_lng | REAL | NOT NULL | Geographic jurisdiction bounding box (used by Agent-5 Router) |
| phone, email | TEXT | | Authority contact |

### 3. STAFF (Authority employee)
| Attribute | Type | Constraints | Description |
|---|---|---|---|
| staff_id | INTEGER | **PK** | Unique staff ID |
| full_name | TEXT | NOT NULL | Staff name |
| email | TEXT | NOT NULL, **UNIQUE** | Login identifier |
| password_hash | TEXT | NOT NULL | Hashed password |
| department | TEXT | NOT NULL | road / electricity / water / gas / sanitation / general |
| authority_id | INTEGER | **FK → AUTHORITY** | The authority the staff belongs to |

### 4. COMPLAINT
| Attribute | Type | Constraints | Description |
|---|---|---|---|
| complaint_id | INTEGER | **PK** | Unique complaint ID |
| user_id | INTEGER | **FK → USER** | Submitter |
| authority_id | INTEGER | **FK → AUTHORITY** | Routed destination (Agent-5) |
| assigned_staff_id | INTEGER | **FK → STAFF**, nullable | Staff handling it |
| duplicate_of_id | INTEGER | **FK → COMPLAINT** (self), nullable | Set when merged into an existing similar complaint |
| title | TEXT | NOT NULL | Short title |
| description | TEXT | NOT NULL | Full text/voice-transcribed description |
| category | TEXT | NOT NULL | road / electricity / water / gas / sanitation / other (Agent-2) |
| image_url | TEXT | nullable | Optional attached photo (verified by Agent-1) |
| latitude, longitude | REAL | NOT NULL | Exact GPS location |
| status | TEXT | NOT NULL | submitted / verified / rejected / merged / in_process / resolved |
| priority_score | REAL | DEFAULT 0 | Computed by Agent-4 (votes + severity + time) |
| vote_count | INTEGER | DEFAULT 0 | Total upvotes (incl. merged duplicates) |
| eta_hours | INTEGER | nullable | Deadline set by staff when marked "in process" |
| created_at / updated_at / resolved_at | DATETIME | | Timestamps |

### 5. VOTE (weak entity — resolves USER ⇄ COMPLAINT M:N)
| Attribute | Type | Constraints |
|---|---|---|
| vote_id | INTEGER | **PK** |
| user_id | INTEGER | **FK → USER** |
| complaint_id | INTEGER | **FK → COMPLAINT** |
| created_at | DATETIME | |
| *UNIQUE(user_id, complaint_id)* | | one vote per citizen per complaint |

### 6. EMERGENCY_SERVICE (public — no login required)
| Attribute | Type | Constraints | Description |
|---|---|---|---|
| service_id | INTEGER | **PK** | |
| name | TEXT | NOT NULL | e.g. "Ramna Fire Station" |
| type | TEXT | NOT NULL | fire_service / police / wasa / lged / desa / titas_gas / public_toilet |
| phone | TEXT | NOT NULL | Emergency hotline |
| address | TEXT | | |
| latitude, longitude | REAL | NOT NULL | Used for "nearby" search |

### 7. COMPLAINT_STATUS_HISTORY (audit trail)
| Attribute | Type | Constraints |
|---|---|---|
| history_id | INTEGER | **PK** |
| complaint_id | INTEGER | **FK → COMPLAINT** |
| old_status / new_status | TEXT | |
| note | TEXT | e.g. "ETA 48h – repair crew scheduled" |
| changed_by | TEXT | staff email or "system-agent" |
| changed_at | DATETIME | |

### 8. NOTIFICATION
| Attribute | Type | Constraints |
|---|---|---|
| notification_id | INTEGER | **PK** |
| user_id | INTEGER | **FK → USER** |
| complaint_id | INTEGER | **FK → COMPLAINT**, nullable |
| title / message | TEXT | e.g. "The problem solving is in progress" |
| is_read | INTEGER | DEFAULT 0 |
| created_at | DATETIME | |

### 9. AGENT_LOG (agentic pipeline audit — great for your viva demo!)
| Attribute | Type | Constraints |
|---|---|---|
| log_id | INTEGER | **PK** |
| complaint_id | INTEGER | **FK → COMPLAINT**, nullable |
| agent_name | TEXT | photo_verifier / classifier / duplicate_checker / priority_ranker / router |
| decision | TEXT | verified / rejected / unique / duplicate / routed-to:X … |
| input_summary / output_summary | TEXT | Human-readable reasoning trace |
| created_at | DATETIME | |

---

## Relationships & Cardinalities

```
USER        ||──o{  COMPLAINT                : submits (1:N)
USER        ||──o{  VOTE                    : casts   (1:N)
COMPLAINT   ||──o{  VOTE                    : receives(1:N)   ⇒ USER M:N COMPLAINT via VOTE
AUTHORITY   ||──o{  STAFF                   : employs (1:N)
AUTHORITY   ||──o{  COMPLAINT               : receives(routed) (1:N)
STAFF       |o──o{  COMPLAINT               : handles (0..1:N)
COMPLAINT   ||──o{  STATUS_HISTORY          : tracks  (1:N)
COMPLAINT   |o──o|  COMPLAINT               : duplicate_of (self-reference)
COMPLAINT   ||──o{  AGENT_LOG               : processed-by pipeline (1:N)
USER        ||──o{  NOTIFICATION            : receives (1:N)
COMPLAINT   ||──o{  NOTIFICATION            : triggers (1:N)
EMERGENCY_SERVICE : standalone entity (no FK) — queried by GPS proximity
```

## Business Rules encoded in the design

1. **Public access without login** → only `EMERGENCY_SERVICES` and read-only browsing of complaints need no auth.
2. **Complaint submission requires login** → `COMPLAINT.user_id` is NOT NULL.
3. **Auto-routing** → `COMPLAINT.authority_id` is filled by Agent-5 from GPS bounds stored in `AUTHORITY`.
4. **Exact-similar complaint = vote** → new complaint within GPS radius of an active similar one becomes a row with `duplicate_of_id` set AND inserts a `VOTE` for the original (`vote_count + 1`).
5. **Lock while in progress** → when `status = 'in_process'`, voting/duplicate-merging is blocked; citizen sees *"The problem solving is in progress"*.
6. **Transparency** → every status change by staff writes a `STATUS_HISTORY` row and a `NOTIFICATION` to the citizen.
