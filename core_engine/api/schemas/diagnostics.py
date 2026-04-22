from pydantic import BaseModel
from typing import List, Optional, Dict

class AutomatedFlags(BaseModel):
    spelling_grammar_passed: bool
    cta_present: bool
    logo_visible: bool
    safe_zones_passed: bool
    resolution_passed: bool
    qr_code_scannable: Optional[bool] = None

class HybridFlags(BaseModel):
    pacing_warnings: List[str] = []
    transition_warnings: List[str] = []
    brand_voice_score: float = 0.0

class FinalDecision(BaseModel):
    strategy_category: str = "Uncategorized"  # Eye-Catching, Storytelling, Clever Concept
    approved: bool = False
    revisions_required: bool = True

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
    
    # 4. Puerta Final
    final_decision: FinalDecision

class VideoInferenceRequest(BaseModel):
    video_url: Optional[str] = None
    frame_rate: int = 1
    analysis_depth: str = "standard"
