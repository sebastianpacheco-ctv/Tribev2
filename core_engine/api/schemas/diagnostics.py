from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class AutomatedFlags(BaseModel):
    spelling_grammar_passed: bool
    cta_present: bool
    logo_visible: bool
    safe_zones_passed: bool
    resolution_passed: bool
    qr_code_scannable: Optional[bool] = None

class HybridFlags(BaseModel):
    pacing_warnings: List[str] = Field(default_factory=list)
    transition_warnings: List[str] = Field(default_factory=list)
    brand_voice_score: float = 0.0

class FinalDecision(BaseModel):
    strategy_category: str = "Uncategorized"  # Eye-Catching, Storytelling, Clever Concept
    approved: bool = False
    revisions_required: bool = True

class ActionableStep(BaseModel):
    priority: str
    title: str
    rationale: str
    frame_range: str

class FrameInsight(BaseModel):
    frame_index: int
    timestamp_seconds: float
    dominant_region: str
    attention_score: float
    emotional_response: float
    sensory_load: float
    cognitive_response: str
    recommendation: str
    attention_map: Optional[List[List[float]]] = None

class DiagnosticResult(BaseModel):
    request_id: str
    timestamp: str
    
    # 1. Tareas deterministas y objetivas (IA Resuelve 100%)
    ai_automated: AutomatedFlags
    
    # 2. Tareas subjetivas o de advertencia (IA sugiere, Humano confirma)
    hybrid_flags: HybridFlags
    
    # 3. Datos puros del Tensor/Cerebro preservados para el UI (Resonancia, Atención 0-100)
    attention_score: float
    neural_resonance: float
    region_activations: Dict[str, float] = Field(default_factory=dict)
    prediction_confidence: float = 0.0
    sensory_load: float = 0.0
    frames_analyzed: int = 0
    frame_insights: List[FrameInsight] = Field(default_factory=list)
    actionable_steps: List[ActionableStep] = Field(default_factory=list)
    
    # 4. Puerta Final
    final_decision: FinalDecision

class VideoInferenceRequest(BaseModel):
    request_id: Optional[str] = None
    video_url: Optional[str] = None
    frame_rate: float = 1.0
    analysis_depth: str = "standard"
    format_type: str = "bespoke"  # "bespoke" | "frame" | "standard_video"

class UploadVideoResponse(BaseModel):
    request_id: str
    filename: str
    status: str = "uploaded"
    message: str = "Video saved and queued for frame extraction."

class HistorySummary(BaseModel):
    request_id: str
    filename: str
    analyzed_at: str
    attention_score: float
    approved: bool
    strategy_category: str
    frames_analyzed: int
