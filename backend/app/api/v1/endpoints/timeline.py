# -*- coding: utf-8 -*-
"""MediFlow AI - Timeline & Care Journey Endpoints
Endpoints for viewing daily dose schedules, meal associations, and tracking medication adherence.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.timeline import (
    CarePlanResponse,
    DailyMedicationTimeline,
    DoseStatus,
)
from app.services.timeline_service import timeline_service

router = APIRouter()


class UpdateDoseStatusRequest(BaseModel):
    status: DoseStatus


@router.get(
    "/care-plan/{patient_id}",
    response_model=CarePlanResponse,
    summary="Get patient's active care journey and overall regimen",
)
async def get_patient_care_plan(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
) -> CarePlanResponse:
    plan = await timeline_service.get_patient_active_care_plan(db, patient_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active care plan found for patient ID '{patient_id}'.",
        )
    return plan


@router.get(
    "/daily/{patient_id}",
    response_model=DailyMedicationTimeline,
    summary="Get daily medication schedule and adherence status",
)
async def get_daily_timeline(
    patient_id: str,
    target_date: Optional[str] = Query(
        default=None,
        description="Target ISO date string (YYYY-MM-DD); defaults to today",
    ),
    db: AsyncSession = Depends(get_db),
) -> DailyMedicationTimeline:
    timeline = await timeline_service.get_daily_timeline(db, patient_id, target_date)
    return timeline


@router.post(
    "/dose/{patient_id}/{dose_id}/status",
    summary="Update dose status (taken or skipped)",
)
async def update_dose_status(
    patient_id: str,
    dose_id: str,
    body: UpdateDoseStatusRequest,
    db: AsyncSession = Depends(get_db),
):
    success = await timeline_service.update_dose_status(db, patient_id, dose_id, body.status)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not update dose status. Verify patient_id and dose_id.",
        )
    return {"message": "Dose status updated successfully", "dose_id": dose_id, "new_status": body.status.value}
