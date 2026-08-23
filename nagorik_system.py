from __future__ import annotations

import json
import uuid
import hashlib
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum, auto
from typing import Optional, List, Dict, Tuple
from collections import defaultdict


# ---------------------------------------------------------------------------
# Enums & Constants
# ---------------------------------------------------------------------------

class Category(Enum):
    ROAD       = "Road"
    WATER      = "Water"
    GAS        = "Gas"
    POWER      = "Power"
    SANITATION = "Sanitation"


class Destination(Enum):
    """
    Which local government body is responsible for this GPS location?
    Based on Bangladesh administrative zones.
    """
    CITY_CORPORATION = "City Corporation"   # Large cities: Dhaka, Chittagong, Khulna, etc.
    POUROSHOVA       = "Pouroshova"         # Small towns / municipality areas
    UNION_PARISHAD   = "Union Parishad"     # Rural / village areas


class Status(Enum):
    SUBMITTED          = auto()
    VERIFYING          = auto()
    REJECTED           = auto()
    CLASSIFIED         = auto()
    CHECKING_DUPLICATE = auto()
    MERGED             = auto()
    RANKED             = auto()
    ROUTED             = auto()
    ASSIGNED           = auto()
    IN_PROGRESS        = auto()
    RESOLVED           = auto()


class Severity(Enum):
    LOW      = 1
    MEDIUM   = 2
    HIGH     = 3
    CRITICAL = 4


# ---------------------------------------------------------------------------
# GPS Zone Definitions
# ---------------------------------------------------------------------------

@dataclass
class GPSZone:
    """
    Defines a geographic bounding box for a local government area.
    lat_min, lat_max, lon_min, lon_max — all in decimal degrees.
    """
    name:        str
    destination: Destination
    lat_min:     float
    lat_max:     float
    lon_min:     float
    lon_max:     float
    description: str = ""

    def contains(self, lat: float, lon: float) -> bool:
        return (self.lat_min <= lat <= self.lat_max and
                self.lon_min <= lon <= self.lon_max)


# ---------------------------------------------------------------------------
# Bangladesh GPS Zone Registry
# ---------------------------------------------------------------------------
# Real bounding boxes for major Bangladeshi cities and rural zones.
# EDITABLE: Add more zones, adjust boundaries, or load from a database.

BD_GPS_ZONES: List[GPSZone] = [

    # ── CITY CORPORATIONS ──────────────────────────────────────────────────
    GPSZone(
        name="Dhaka North & South City Corporation",
        destination=Destination.CITY_CORPORATION,
        lat_min=23.680, lat_max=23.890,
        lon_min=90.320, lon_max=90.480,
        description="Dhaka metropolitan area",
    ),
    GPSZone(
        name="Chittagong City Corporation",
        destination=Destination.CITY_CORPORATION,
        lat_min=22.290, lat_max=22.430,
        lon_min=91.760, lon_max=91.870,
        description="Chittagong city area",
    ),
    GPSZone(
        name="Khulna City Corporation",
        destination=Destination.CITY_CORPORATION,
        lat_min=22.790, lat_max=22.880,
        lon_min=89.510, lon_max=89.600,
        description="Khulna city area",
    ),
    GPSZone(
        name="Rajshahi City Corporation",
        destination=Destination.CITY_CORPORATION,
        lat_min=24.340, lat_max=24.410,
        lon_min=88.560, lon_max=88.640,
        description="Rajshahi city area",
    ),
    GPSZone(
        name="Sylhet City Corporation",
        destination=Destination.CITY_CORPORATION,
        lat_min=24.870, lat_max=24.930,
        lon_min=91.840, lon_max=91.910,
        description="Sylhet city area",
    ),
    GPSZone(
        name="Gazipur City Corporation",
        destination=Destination.CITY_CORPORATION,
        lat_min=23.950, lat_max=24.080,
        lon_min=90.390, lon_max=90.480,
        description="Gazipur industrial city",
    ),
    GPSZone(
        name="Narayanganj City Corporation",
        destination=Destination.CITY_CORPORATION,
        lat_min=23.600, lat_max=23.660,
        lon_min=90.480, lon_max=90.550,
        description="Narayanganj city",
    ),
    GPSZone(
        name="Cumilla City Corporation",
        destination=Destination.CITY_CORPORATION,
        lat_min=23.440, lat_max=23.490,
        lon_min=91.160, lon_max=91.220,
        description="Cumilla city area",
    ),

    # ── POUROSHOVA (MUNICIPALITY / SMALL TOWNS) ───────────────────────────
    GPSZone(
        name="Savar Pouroshova",
        destination=Destination.POUROSHOVA,
        lat_min=23.840, lat_max=23.890,
        lon_min=90.250, lon_max=90.310,
        description="Savar town near Dhaka",
    ),
    GPSZone(
        name="Narsingdi Pouroshova",
        destination=Destination.POUROSHOVA,
        lat_min=23.910, lat_max=23.970,
        lon_min=90.700, lon_max=90.760,
        description="Narsingdi town",
    ),
    GPSZone(
        name="Jessore Pouroshova",
        destination=Destination.POUROSHOVA,
        lat_min=23.150, lat_max=23.200,
        lon_min=89.190, lon_max=89.250,
        description="Jessore town",
    ),
    GPSZone(
        name="Bogura Pouroshova",
        destination=Destination.POUROSHOVA,
        lat_min=24.840, lat_max=24.890,
        lon_min=89.340, lon_max=89.400,
        description="Bogura town",
    ),
    GPSZone(
        name="Mymensingh Pouroshova",
        destination=Destination.POUROSHOVA,
        lat_min=24.730, lat_max=24.780,
        lon_min=90.380, lon_max=90.430,
        description="Mymensingh town",
    ),
    GPSZone(
        name="Rangpur Pouroshova",
        destination=Destination.POUROSHOVA,
        lat_min=25.730, lat_max=25.780,
        lon_min=89.220, lon_max=89.290,
        description="Rangpur town",
    ),
    GPSZone(
        name="Barisal Pouroshova",
        destination=Destination.POUROSHOVA,
        lat_min=22.680, lat_max=22.730,
        lon_min=90.340, lon_max=90.400,
        description="Barisal town",
    ),
    GPSZone(
        name="Chandpur Pouroshova",
        destination=Destination.POUROSHOVA,
        lat_min=23.220, lat_max=23.270,
        lon_min=90.640, lon_max=90.700,
        description="Chandpur town",
    ),

    # ── UNION PARISHAD (RURAL ZONES) ──────────────────────────────────────
    # Bangladesh rural zones covering areas outside city/pouroshova
    GPSZone(
        name="Sylhet Rural Union Parishad",
        destination=Destination.UNION_PARISHAD,
        lat_min=24.500, lat_max=24.860,
        lon_min=91.600, lon_max=92.500,
        description="Rural Sylhet division",
    ),
    GPSZone(
        name="Chittagong Rural Union Parishad",
        destination=Destination.UNION_PARISHAD,
        lat_min=21.500, lat_max=22.280,
        lon_min=91.500, lon_max=92.800,
        description="Rural Chittagong division",
    ),
    GPSZone(
        name="Rajshahi Rural Union Parishad",
        destination=Destination.UNION_PARISHAD,
        lat_min=24.000, lat_max=24.330,
        lon_min=88.300, lon_max=89.200,
        description="Rural Rajshahi division",
    ),
    GPSZone(
        name="Khulna Rural Union Parishad",
        destination=Destination.UNION_PARISHAD,
        lat_min=22.000, lat_max=22.780,
        lon_min=89.100, lon_max=89.800,
        description="Rural Khulna division",
    ),
    GPSZone(
        name="Rangpur Rural Union Parishad",
        destination=Destination.UNION_PARISHAD,
        lat_min=25.100, lat_max=26.600,
        lon_min=88.700, lon_max=89.500,
        description="Rural Rangpur division",
    ),
    GPSZone(
        name="Mymensingh Rural Union Parishad",
        destination=Destination.UNION_PARISHAD,
        lat_min=24.200, lat_max=25.100,
        lon_min=89.900, lon_max=91.100,
        description="Rural Mymensingh division",
    ),
    GPSZone(
        name="Barisal Rural Union Parishad",
        destination=Destination.UNION_PARISHAD,
        lat_min=21.800, lat_max=22.670,
        lon_min=89.900, lon_max=90.800,
        description="Rural Barisal division",
    ),
    GPSZone(
        name="Dhaka Rural Union Parishad",
        destination=Destination.UNION_PARISHAD,
        lat_min=23.200, lat_max=24.500,
        lon_min=89.800, lon_max=91.000,
        description="Rural Dhaka division (outside metro)",
    ),
]


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

@dataclass
class GPSLocation:
    lat: float
    lon: float

    def distance_km(self, other: GPSLocation) -> float:
        """Haversine distance between two GPS points."""
        from math import radians, sin, cos, sqrt, atan2
        R = 6371.0
        lat1, lon1 = radians(self.lat), radians(self.lon)
        lat2, lon2 = radians(other.lat), radians(other.lon)
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        return R * 2 * atan2(sqrt(a), sqrt(1 - a))


@dataclass
class Complaint:
    id:           str            = field(default_factory=lambda: str(uuid.uuid4())[:8])
    citizen_id:   str            = ""
    photo_url:    str            = ""
    description:  str            = ""
    gps:          Optional[GPSLocation] = None
    submitted_at: datetime       = field(default_factory=datetime.now)

    # Pipeline outputs
    status:           Status              = Status.SUBMITTED
    category:         Optional[Category]    = None
    destination:      Optional[Destination] = None   # ← NEW: replaces department
    zone_name:        str                   = ""      # ← NEW: which zone name matched
    priority_score:   float                 = 0.0
    severity:         Severity              = Severity.LOW
    vote_count:       int                   = 1
    merged_into:      Optional[str]         = None
    rejection_reason: str                   = ""
    assigned_staff_id: Optional[str]        = None
    resolved_at:      Optional[datetime]    = None
    resolution_notes: str                   = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d["status"]      = self.status.name
        d["category"]    = self.category.value    if self.category    else None
        d["destination"] = self.destination.value if self.destination else None
        d["severity"]    = self.severity.name
        d["submitted_at"]= self.submitted_at.isoformat()
        d["resolved_at"] = self.resolved_at.isoformat() if self.resolved_at else None
        return d


@dataclass
class Notification:
    citizen_id: str
    message:    str
    channel:    str              = "app"   # "sms" | "app" | "email"
    sent_at:    Optional[datetime] = None


# ---------------------------------------------------------------------------
# Agent 1 — Photo Verifier
# ---------------------------------------------------------------------------

class PhotoVerifier:
    """
    Checks if the submitted image is real, relevant, and not fake.
    EDITABLE: Replace stub logic with a real vision classifier (e.g. CLIP).
    """
    FAKE_KEYWORDS = {"stock photo", "meme", "selfie", "party", "advertisement"}

    def verify(self, complaint: Complaint) -> Tuple[bool, str]:
        """Returns (is_valid, rejection_reason)."""
        if not complaint.photo_url:
            return False, "No photo attached."
        desc_lower = complaint.description.lower()
        if any(kw in desc_lower for kw in self.FAKE_KEYWORDS):
            return False, "Image appears irrelevant or fake."
        return True, ""


# ---------------------------------------------------------------------------
# Agent 2 — Classifier
# ---------------------------------------------------------------------------

class Classifier:
    """
    Classifies complaint into Road / Water / Gas / Power / Sanitation.
    EDITABLE: Replace keyword matching with an NLP model (BERT/bangla-bert).
    """
    KEYWORDS: Dict[Category, List[str]] = {
        Category.ROAD:       ["pothole", "road", "street", "broken road", "crack", "pavement"],
        Category.WATER:      ["water", "pipe", "leak", "flood", "drainage", "wasa", "supply"],
        Category.GAS:        ["gas", "gas leak", "pipeline", "titas", "smell gas", "gas line"],
        Category.POWER:      ["electricity", "power", "line down", "transformer", "desa", "blackout"],
        Category.SANITATION: ["garbage", "trash", "sewage", "toilet", "sanitation", "waste", "drain"],
    }

    def classify(self, complaint: Complaint) -> Category:
        desc_lower = complaint.description.lower()
        scores: Dict[Category, int] = defaultdict(int)
        for category, keywords in self.KEYWORDS.items():
            for kw in keywords:
                if kw in desc_lower:
                    scores[category] += 1
        return max(scores, key=scores.get) if scores else Category.ROAD


# ---------------------------------------------------------------------------
# Agent 3 — Duplicate Checker
# ---------------------------------------------------------------------------

class DuplicateChecker:
    """
    Scans GPS radius for similar complaints already in the system.
    If duplicate found → merge (vote count +1).
    EDITABLE: Adjust DUPLICATE_RADIUS_KM.
    """
    DUPLICATE_RADIUS_KM = 0.3  # 300 metres

    def __init__(self, store: ComplaintStore):
        self.store = store

    def check(self, complaint: Complaint) -> Optional[str]:
        """Returns ID of existing duplicate, or None if unique."""
        if not complaint.gps:
            return None
        for existing in self.store.get_active():
            if existing.id == complaint.id:
                continue
            if existing.category != complaint.category:
                continue
            if not existing.gps:
                continue
            if complaint.gps.distance_km(existing.gps) <= self.DUPLICATE_RADIUS_KM:
                return existing.id
        return None


# ---------------------------------------------------------------------------
# Agent 4 — Priority Ranker
# ---------------------------------------------------------------------------

class PriorityRanker:
    """
    Scores complaint by: severity × weight + votes × weight + hours elapsed × weight.
    Higher score = higher priority in the staff queue.
    EDITABLE: Tune weights.
    """
    SEVERITY_WEIGHT = 10.0
    VOTE_WEIGHT     = 2.0
    TIME_WEIGHT     = 0.5   # points per hour elapsed

    def rank(self, complaint: Complaint) -> float:
        hours = (datetime.now() - complaint.submitted_at).total_seconds() / 3600
        score = (
            complaint.severity.value * self.SEVERITY_WEIGHT +
            complaint.vote_count     * self.VOTE_WEIGHT     +
            hours                    * self.TIME_WEIGHT
        )
        complaint.priority_score = round(score, 2)
        return complaint.priority_score


# ---------------------------------------------------------------------------
# Agent 5 — Destination Router  ← CHANGED from DepartmentRouter
# ---------------------------------------------------------------------------

class DestinationRouter:
    """
    Determines WHICH LOCAL GOVERNMENT BODY is responsible for the complaint
    based on the GPS coordinates of the location.

    Logic:
      1. Check all defined GPS zones in BD_GPS_ZONES.
      2. First matching zone wins → assign its Destination + zone name.
      3. If no zone matches → default to Union Parishad (rural/unknown).

    EDITABLE:
      - Add more zones to BD_GPS_ZONES above.
      - Swap bounding-box logic for PostGIS polygon query in production.
    """

    def route(self, complaint: Complaint) -> Tuple[Destination, str]:
        """
        Returns (Destination, zone_name).
        zone_name is the human-readable name of the matched zone.
        """
        if not complaint.gps:
            return Destination.UNION_PARISHAD, "Unknown (no GPS)"

        lat, lon = complaint.gps.lat, complaint.gps.lon

        for zone in BD_GPS_ZONES:
            if zone.contains(lat, lon):
                return zone.destination, zone.name

        # Outside all defined zones — treat as rural Union Parishad
        return Destination.UNION_PARISHAD, f"Unknown rural area ({lat:.4f}, {lon:.4f})"


# ---------------------------------------------------------------------------
# Data Store (in-memory — swap for PostgreSQL in production)
# ---------------------------------------------------------------------------

class ComplaintStore:
    def __init__(self):
        self._complaints:   Dict[str, Complaint]  = {}
        self._notifications: List[Notification]   = []

    def save(self, complaint: Complaint):
        self._complaints[complaint.id] = complaint

    def get(self, complaint_id: str) -> Optional[Complaint]:
        return self._complaints.get(complaint_id)

    def get_active(self) -> List[Complaint]:
        exclude = {Status.REJECTED, Status.MERGED, Status.RESOLVED}
        return [c for c in self._complaints.values() if c.status not in exclude]

    def get_by_destination(self, dest: Destination) -> List[Complaint]:
        """Return all open complaints for a specific destination."""
        return [
            c for c in self._complaints.values()
            if c.destination == dest
            and c.status not in {Status.RESOLVED, Status.REJECTED, Status.MERGED}
        ]

    def list_all(self) -> List[Complaint]:
        return list(self._complaints.values())

    def add_notification(self, n: Notification):
        self._notifications.append(n)


# ---------------------------------------------------------------------------
# Pipeline Orchestrator
# ---------------------------------------------------------------------------

class NagorikPipeline:
    """
    Runs the full 5-agent complaint pipeline end-to-end.

    Flow:
      Submit → Agent1(Photo) → Agent2(Classify) → Agent3(Duplicate)
             → Agent4(Priority) → Agent5(Destination) → ASSIGNED
    """
    def __init__(self, store: ComplaintStore):
        self.store      = store
        self.verifier   = PhotoVerifier()
        self.classifier = Classifier()
        self.dup_check  = DuplicateChecker(store)
        self.ranker     = PriorityRanker()
        self.router     = DestinationRouter()   # ← updated

    def submit(self, citizen_id: str, photo_url: str, description: str,
               lat: float, lon: float,
               severity: Severity = Severity.MEDIUM) -> Complaint:
        """Entry point: citizen submits a complaint."""
        complaint = Complaint(
            citizen_id=citizen_id,
            photo_url=photo_url,
            description=description,
            gps=GPSLocation(lat, lon),
            severity=severity,
        )
        self.store.save(complaint)
        self._run_pipeline(complaint)
        return complaint

    def _run_pipeline(self, c: Complaint):

        # ── Agent 1: Photo Verifier ────────────────────────────────────────
        c.status = Status.VERIFYING
        is_valid, reason = self.verifier.verify(c)
        if not is_valid:
            c.status = Status.REJECTED
            c.rejection_reason = reason
            self._notify(c.citizen_id,
                         f"Your complaint was rejected: {reason}")
            return

        # ── Agent 2: Classifier ────────────────────────────────────────────
        c.category = self.classifier.classify(c)
        c.status   = Status.CLASSIFIED

        # ── Agent 3: Duplicate Checker ─────────────────────────────────────
        c.status      = Status.CHECKING_DUPLICATE
        duplicate_id  = self.dup_check.check(c)
        if duplicate_id:
            original = self.store.get(duplicate_id)
            if original:
                original.vote_count += 1
                c.status      = Status.MERGED
                c.merged_into = duplicate_id
                self._notify(c.citizen_id,
                             "Your complaint was merged with an existing one nearby. Vote counted (+1).")
                return

        # ── Agent 4: Priority Ranker ───────────────────────────────────────
        self.ranker.rank(c)
        c.status = Status.RANKED

        # ── Agent 5: Destination Router ────────────────────────────────────
        destination, zone_name = self.router.route(c)
        c.destination = destination
        c.zone_name   = zone_name
        c.status      = Status.ROUTED

        # ── Auto-assign to staff dashboard ─────────────────────────────────
        c.status = Status.ASSIGNED

    def _notify(self, citizen_id: str, message: str, channel: str = "app"):
        n = Notification(citizen_id=citizen_id, message=message, channel=channel)
        n.sent_at = datetime.now()
        self.store.add_notification(n)


# ---------------------------------------------------------------------------
# Staff Dashboard
# ---------------------------------------------------------------------------

class StaffDashboard:
    """
    Interface for govt staff:
    view complaints by destination, assign to a worker, resolve.
    """
    def __init__(self, store: ComplaintStore):
        self.store = store

    def get_queue(self, dest: Destination) -> List[Complaint]:
        """All open complaints for a destination, sorted by priority (highest first)."""
        complaints = self.store.get_by_destination(dest)
        complaints.sort(key=lambda c: c.priority_score, reverse=True)
        return complaints

    def assign_to_staff(self, complaint_id: str, staff_id: str) -> bool:
        c = self.store.get(complaint_id)
        if c and c.status == Status.ASSIGNED:
            c.assigned_staff_id = staff_id
            c.status            = Status.IN_PROGRESS
            return True
        return False

    def resolve(self, complaint_id: str, notes: str = "") -> bool:
        """Resolve complaint and notify citizen via SMS."""
        c = self.store.get(complaint_id)
        if not c or c.status == Status.RESOLVED:
            return False
        c.status           = Status.RESOLVED
        c.resolved_at      = datetime.now()
        c.resolution_notes = notes
        cat_label = c.category.value.lower() if c.category else "complaint"
        self._notify_sms(c.citizen_id,
                         f"Your {cat_label} complaint has been resolved by {c.destination.value if c.destination else 'local authority'}.")
        return True

    def _notify_sms(self, citizen_id: str, message: str):
        n = Notification(citizen_id=citizen_id, message=message, channel="sms")
        n.sent_at = datetime.now()
        self.store.add_notification(n)

    def generate_report(self, dest: Optional[Destination] = None) -> dict:
        complaints = self.store.list_all() if dest is None else self.store.get_by_destination(dest)
        total    = len(complaints)
        resolved = sum(1 for c in complaints if c.status == Status.RESOLVED)
        pending  = sum(1 for c in complaints if c.status in {Status.ASSIGNED, Status.IN_PROGRESS})
        avg_pri  = sum(c.priority_score for c in complaints) / total if total else 0
        return {
            "destination":          dest.value if dest else "All",
            "total_complaints":     total,
            "resolved":             resolved,
            "pending":              pending,
            "average_priority":     round(avg_pri, 2),
        }


# ---------------------------------------------------------------------------
# DEMO
# ---------------------------------------------------------------------------

def demo():
    store     = ComplaintStore()
    pipeline  = NagorikPipeline(store)
    dashboard = StaffDashboard(store)

    SEP = "=" * 65

    print(SEP)
    print("  NAGORIK SHEBA — COMPLAINT PIPELINE DEMO  (v2 — Destination Router)")
    print(SEP)

    # ── 1. Water complaint in Khulna City Corporation ──────────────────────
    c1 = pipeline.submit(
        citizen_id  = "citizen_001",
        photo_url   = "https://example.com/leak.jpg",
        description = "Water pipe burst near Shibbari Road. Flooding the street badly.",
        lat=22.830, lon=89.550,          # inside Khulna City Corporation zone
        severity    = Severity.HIGH,
    )
    print(f"\n[1] Citizen 001 — Water leak (Khulna)")
    print(f"    ID: {c1.id}  |  Status : {c1.status.name}")
    print(f"    Category   : {c1.category.value if c1.category else 'N/A'}")
    print(f"    Destination: {c1.destination.value if c1.destination else 'N/A'}")
    print(f"    Zone       : {c1.zone_name}")
    print(f"    Priority   : {c1.priority_score}")

    # ── 2. Same area duplicate (should merge) ──────────────────────────────
    c2 = pipeline.submit(
        citizen_id  = "citizen_002",
        photo_url   = "https://example.com/leak2.jpg",
        description = "Same water leak near Shibbari Road. Still not fixed.",
        lat=22.8302, lon=89.5502,        # ~22 m away → within 300 m radius
        severity    = Severity.MEDIUM,
    )
    print(f"\n[2] Citizen 002 — Nearby duplicate of water leak")
    print(f"    ID: {c2.id}  |  Status: {c2.status.name}")
    if c2.status == Status.MERGED:
        original = store.get(c2.merged_into)
        print(f"    Merged into {c2.merged_into}  |  Original vote count → {original.vote_count}")

    # ── 3. Road complaint in a Pouroshova town ─────────────────────────────
    c3 = pipeline.submit(
        citizen_id  = "citizen_003",
        photo_url   = "https://example.com/pothole.jpg",
        description = "Huge pothole on main road causing accidents every day.",
        lat=23.860, lon=90.270,          # inside Savar Pouroshova zone
        severity    = Severity.CRITICAL,
    )
    print(f"\n[3] Citizen 003 — Pothole (Savar)")
    print(f"    ID: {c3.id}  |  Status : {c3.status.name}")
    print(f"    Category   : {c3.category.value if c3.category else 'N/A'}")
    print(f"    Destination: {c3.destination.value if c3.destination else 'N/A'}")
    print(f"    Zone       : {c3.zone_name}")
    print(f"    Priority   : {c3.priority_score}")

    # ── 4. Gas leak in a rural Union Parishad area ─────────────────────────
    c4 = pipeline.submit(
        citizen_id  = "citizen_004",
        photo_url   = "https://example.com/gas.jpg",
        description = "Gas smell coming from pipeline near the field. Dangerous gas leak.",
        lat=24.100, lon=89.600,          # rural Dhaka division → Union Parishad
        severity    = Severity.CRITICAL,
    )
    print(f"\n[4] Citizen 004 — Gas leak (Rural area)")
    print(f"    ID: {c4.id}  |  Status : {c4.status.name}")
    print(f"    Category   : {c4.category.value if c4.category else 'N/A'}")
    print(f"    Destination: {c4.destination.value if c4.destination else 'N/A'}")
    print(f"    Zone       : {c4.zone_name}")
    print(f"    Priority   : {c4.priority_score}")

    # ── 5. Electricity complaint in Dhaka City Corporation ─────────────────
    c5 = pipeline.submit(
        citizen_id  = "citizen_005",
        photo_url   = "https://example.com/power.jpg",
        description = "Transformer line down since yesterday. No electricity in entire block.",
        lat=23.750, lon=90.400,          # inside Dhaka City Corporation zone
        severity    = Severity.HIGH,
    )
    print(f"\n[5] Citizen 005 — Power outage (Dhaka)")
    print(f"    ID: {c5.id}  |  Status : {c5.status.name}")
    print(f"    Category   : {c5.category.value if c5.category else 'N/A'}")
    print(f"    Destination: {c5.destination.value if c5.destination else 'N/A'}")
    print(f"    Zone       : {c5.zone_name}")
    print(f"    Priority   : {c5.priority_score}")

    # ── 6. Fake complaint — should be rejected ─────────────────────────────
    c6 = pipeline.submit(
        citizen_id  = "citizen_006",
        photo_url   = "https://example.com/meme.jpg",
        description = "This is just a meme photo for fun.",
        lat=23.810, lon=90.410,
        severity    = Severity.LOW,
    )
    print(f"\n[6] Citizen 006 — Fake/meme complaint")
    print(f"    ID: {c6.id}  |  Status: {c6.status.name}")
    print(f"    Reason: {c6.rejection_reason}")

    # ── 7. Staff Dashboard — City Corporation queue ─────────────────────────
    print(f"\n{SEP}")
    print("  STAFF DASHBOARD — City Corporation Queue (sorted by priority)")
    print(SEP)
    cc_queue = dashboard.get_queue(Destination.CITY_CORPORATION)
    if cc_queue:
        for c in cc_queue:
            print(f"  [{c.priority_score:5.1f}] #{c.id}  {c.category.value:12}  {c.description[:48]}...")
    else:
        print("  No complaints assigned to City Corporation.")

    # ── 8. Staff Dashboard — Pouroshova queue ──────────────────────────────
    print(f"\n{SEP}")
    print("  STAFF DASHBOARD — Pouroshova Queue")
    print(SEP)
    pour_queue = dashboard.get_queue(Destination.POUROSHOVA)
    if pour_queue:
        for c in pour_queue:
            print(f"  [{c.priority_score:5.1f}] #{c.id}  {c.category.value:12}  {c.description[:48]}...")
    else:
        print("  No complaints assigned to Pouroshova.")

    # ── 9. Staff Dashboard — Union Parishad queue ───────────────────────────
    print(f"\n{SEP}")
    print("  STAFF DASHBOARD — Union Parishad Queue")
    print(SEP)
    up_queue = dashboard.get_queue(Destination.UNION_PARISHAD)
    if up_queue:
        for c in up_queue:
            print(f"  [{c.priority_score:5.1f}] #{c.id}  {c.category.value:12}  {c.description[:48]}...")
    else:
        print("  No complaints assigned to Union Parishad.")

    # ── 10. Assign + Resolve top City Corporation complaint ─────────────────
    if cc_queue:
        top = cc_queue[0]
        print(f"\n{SEP}")
        print("  RESOLVING TOP CITY CORPORATION COMPLAINT")
        print(SEP)
        dashboard.assign_to_staff(top.id, staff_id="staff_cc_01")
        print(f"  Assigned #{top.id} to staff_cc_01  →  {top.status.name}")
        dashboard.resolve(top.id, notes="Issue repaired by maintenance team.")
        print(f"  Resolved  #{top.id}                →  {top.status.name}")

    # ── 11. Summary Report ──────────────────────────────────────────────────
    print(f"\n{SEP}")
    print("  FULL SYSTEM REPORT")
    print(SEP)
    print(json.dumps(dashboard.generate_report(), indent=2))

    # ── 12. Notifications Log ───────────────────────────────────────────────
    print(f"\n{SEP}")
    print("  NOTIFICATIONS SENT")
    print(SEP)
    for n in store._notifications:
        print(f"  [{n.channel:5}]  {n.citizen_id:<15}  {n.message}")


if __name__ == "__main__":
    demo()
