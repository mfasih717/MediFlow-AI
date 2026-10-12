# -*- coding: utf-8 -*-
"""MediFlow AI - Timeline & Care Journey Schemas"""

from datetime import date, datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class TimeSlot(str, Enum):
    MORNING = "morning"        # 08:00 AM
    AFTERNOON = "afternoon"    # 02:00 PM
    EVENING = "evening"        # 08:00 PM
    NIGHT = "night"            # 10:00 PM


class DoseStatus(str, Enum):
    SCHEDULED = "scheduled"
    TAKEN = "taken"
    SKIPPED = "skipped"
    MISSED = "missed"


class ScheduleDose(BaseModel):
    dose_id: str
    medication_name: str
    generic_salt: Optional[str] = None
    strength: str
    time_slot: TimeSlot
    scheduled_time: str = "08:00"
    meal_relation: str = "after_meals"  # "before_meals", "after_meals", "with_meals", "empty_stomach"
    english_instruction: str
    urdu_instruction: str
    status: DoseStatus = DoseStatus.SCHEDULED
    taken_at: Optional[datetime] = None


class DailyMedicationTimeline(BaseModel):
    patient_id: str
    date_str: str
    doses: List[ScheduleDose] = Field(default_factory=list)
    total_doses: int = 0
    taken_doses: int = 0
    adherence_percentage: float = 0.0


class CarePlanCreate(BaseModel):
    patient_id: str
    title: str = "Active Care Journey"
    notes: Optional[str] = None
    document_ids: List[str] = Field(default_factory=list)


class CarePlanResponse(BaseModel):
    care_plan_id: str
    patient_id: str
    title: str
    status: str = "active"
    start_date: date
    end_date: Optional[date] = None
    active_medications_count: int
    daily_schedule: List[ScheduleDose] = Field(default_factory=list)
    urdu_overview: Optional[str] = None
    english_overview: Optional[str] = None
