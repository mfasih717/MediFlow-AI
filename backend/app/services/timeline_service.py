# -*- coding: utf-8 -*-
"""MediFlow AI - Timeline & Care Journey Service
Manages daily medication schedules, chronologically sorted dose reminders, and patient adherence tracking.
"""

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.logging import logger
from app.db.models.clinical import CarePlan
from app.schemas.timeline import (
    DailyMedicationTimeline,
    DoseStatus,
    ScheduleDose,
    TimeSlot,
    CarePlanResponse,
)


class TimelineService:
    """Business logic for medication timelines and patient care plans."""

    async def get_patient_active_care_plan(
        self, session: Optional[AsyncSession], patient_id: str
    ) -> Optional[CarePlanResponse]:
        """Retrieves active care plan for a given patient."""
        if not session:
            return None

        try:
            stmt = (
                select(CarePlan)
                .where(CarePlan.patient_id == patient_id, CarePlan.status == "active")
                .order_by(CarePlan.created_at.desc())
                .limit(1)
            )
            res = await session.execute(stmt)
            plan = res.scalars().first()
            if not plan:
                return None

            schedule_items = [
                ScheduleDose(**item) for item in (plan.schedule_data or [])
            ]

            return CarePlanResponse(
                care_plan_id=plan.id,
                patient_id=plan.patient_id,
                title=plan.title,
                status=plan.status,
                start_date=plan.start_date or date.today(),
                end_date=plan.end_date,
                active_medications_count=len(schedule_items),
                daily_schedule=schedule_items,
                urdu_overview=plan.urdu_overview,
                english_overview=plan.english_overview,
            )
        except Exception as exc:
            logger.error("Error fetching patient care plan: %s", exc)
            return None

    async def get_daily_timeline(
        self, session: Optional[AsyncSession], patient_id: str, target_date: Optional[str] = None
    ) -> DailyMedicationTimeline:
        """Retrieves the full daily medication timeline with adherence stats."""
        day_str = target_date or date.today().isoformat()
        care_plan = await self.get_patient_active_care_plan(session, patient_id)

        if not care_plan or not care_plan.daily_schedule:
            # Return demo/empty schedule if not found in db
            demo_doses = [
                ScheduleDose(
                    dose_id="dose-demo-01",
                    medication_name="Nexum",
                    generic_salt="Esomeprazole",
                    strength="40mg",
                    time_slot=TimeSlot.MORNING,
                    scheduled_time="07:30",
                    meal_relation="empty_stomach",
                    english_instruction="Nexum (40mg) - Take 30 mins before breakfast with water",
                    urdu_instruction="نیکسم (40mg) - صبح ناشتے سے 30 منٹ قبل خالی پیٹ لیں",
                    status=DoseStatus.SCHEDULED,
                ),
                ScheduleDose(
                    dose_id="dose-demo-02",
                    medication_name="Panadol",
                    generic_salt="Paracetamol",
                    strength="500mg",
                    time_slot=TimeSlot.MORNING,
                    scheduled_time="08:30",
                    meal_relation="after_meals",
                    english_instruction="Panadol (500mg) - Take after breakfast with water",
                    urdu_instruction="پیناڈول (500mg) - صبح ناشتے کے بعد پانی کے ساتھ لیں",
                    status=DoseStatus.TAKEN,
                    taken_at=datetime.now(timezone.utc),
                ),
                ScheduleDose(
                    dose_id="dose-demo-03",
                    medication_name="Glucophage",
                    generic_salt="Metformin HCl",
                    strength="500mg",
                    time_slot=TimeSlot.EVENING,
                    scheduled_time="20:00",
                    meal_relation="after_meals",
                    english_instruction="Glucophage (500mg) - Take after dinner with water",
                    urdu_instruction="گلوکوفیج (500mg) - رات کھانے کے بعد پانی کے ساتھ لیں",
                    status=DoseStatus.SCHEDULED,
                ),
            ]
            taken = sum(1 for d in demo_doses if d.status == DoseStatus.TAKEN)
            return DailyMedicationTimeline(
                patient_id=patient_id,
                date_str=day_str,
                doses=demo_doses,
                total_doses=len(demo_doses),
                taken_doses=taken,
                adherence_percentage=round((taken / len(demo_doses)) * 100.0, 1),
            )

        doses = care_plan.daily_schedule
        taken_count = sum(1 for d in doses if d.status == DoseStatus.TAKEN)
        pct = (taken_count / len(doses) * 100.0) if doses else 0.0

        return DailyMedicationTimeline(
            patient_id=patient_id,
            date_str=day_str,
            doses=doses,
            total_doses=len(doses),
            taken_doses=taken_count,
            adherence_percentage=round(pct, 1),
        )

    async def update_dose_status(
        self,
        session: Optional[AsyncSession],
        patient_id: str,
        dose_id: str,
        new_status: DoseStatus,
    ) -> bool:
        """Updates a dose's status (taken, skipped) and commits to care plan."""
        if not session:
            return True

        try:
            stmt = (
                select(CarePlan)
                .where(CarePlan.patient_id == patient_id, CarePlan.status == "active")
                .limit(1)
            )
            res = await session.execute(stmt)
            plan = res.scalars().first()
            if not plan or not plan.schedule_data:
                return False

            schedule = list(plan.schedule_data)
            updated = False
            for item in schedule:
                if item.get("dose_id") == dose_id:
                    item["status"] = new_status.value
                    if new_status == DoseStatus.TAKEN:
                        item["taken_at"] = datetime.now(timezone.utc).isoformat()
                    updated = True
                    break

            if updated:
                plan.schedule_data = schedule
                await session.commit()
                return True
            return False
        except Exception as exc:
            logger.error("Failed to update dose status: %s", exc)
            if session:
                await session.rollback()
            return False


timeline_service = TimelineService()
