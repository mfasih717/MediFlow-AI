# -*- coding: utf-8 -*-
"""MediFlow AI - System Health & AMD ROCm Telemetry Schemas"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AMDROCmDevice(BaseModel):
    card_id: str
    device_name: str
    device_id: Optional[str] = None
    vram_total_mb: float
    vram_used_mb: float
    vram_free_mb: float
    temperature_celsius: float
    gpu_utilization_pct: float
    active_compute_kernels: List[str] = Field(default_factory=list)


class AMDZeroPHIEnforcement(BaseModel):
    local_compute_isolated: bool = True
    cloud_leakage_prevented: bool = True
    phi_retention_guaranteed: bool = True


class AMDROCmTelemetryResponse(BaseModel):
    status: str = "online"
    rocm_version: str = "6.x"
    driver_version: str
    gpu_count: int
    devices: List[AMDROCmDevice]
    hardware_architecture: str
    hip_visible_devices: str
    hsa_override_gfx_version: str
    zero_phi_enforcement: AMDZeroPHIEnforcement


class AMDGPUStatus(BaseModel):
    gpu_available: bool = True
    device_name: str = "AMD Instinct / Radeon ROCm Device"
    rocm_version: str = "6.0"
    driver_version: Optional[str] = None
    vram_used_mb: Optional[float] = None
    vram_total_mb: Optional[float] = None
    compute_units: Optional[int] = None
    telemetry_status: str = "nominal"


class VLLMStatus(BaseModel):
    model_config = {"protected_namespaces": ()}

    online: bool = False
    endpoint: str
    model_name: str
    latency_ms: Optional[float] = None
    active_tokens: Optional[int] = None
    message: str = "AMD ROCm vLLM connection status"


class HealthCheckResponse(BaseModel):
    status: str = "healthy"
    app_name: str = "MediFlow AI"
    version: str = "1.0.0"
    environment: str = "production"
    port: int = 8080
    amd_gpu: AMDGPUStatus
    vllm_engine: VLLMStatus
    database_connected: bool = True
