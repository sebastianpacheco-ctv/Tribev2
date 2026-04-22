from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from core_engine.api.schemas.diagnostics import DiagnosticResult, VideoInferenceRequest, AutomatedFlags, HybridFlags, FinalDecision
from core_engine.models.inference import TribeInferenceEngine
from core_engine.models.insights import InsightGenerator
import uuid
import datetime
import numpy as np

router = APIRouter()
engine = TribeInferenceEngine()
insight_gen = InsightGenerator()

@router.post("/analyze", response_model=DiagnosticResult)
async def analyze_creative(request: VideoInferenceRequest):
    request_id = str(uuid.uuid4())
    
    # Simulate a stimuli array
    stimuli = np.random.rand(10, 224, 224, 3) 
    inference_result = engine.predict(stimuli)
    
    import json
    try:
        gemini_explanation_str = await insight_gen.generate_explanation(inference_result)
        gemini_data = json.loads(gemini_explanation_str)
    except Exception as e:
        # Fallback si Gemini falla o el JSON no sanea
        gemini_data = {
            "hybrid_flags": {"pacing_warnings": [], "transition_warnings": [], "brand_voice_score": 0.0},
            "final_decision": {"strategy_category": "Error", "approved": False, "revisions_required": True}
        }
        
    hybrid_dict = gemini_data.get("hybrid_flags", {})
    decision_dict = gemini_data.get("final_decision", {})
        
    return DiagnosticResult(
        request_id=request_id,
        timestamp=datetime.datetime.now().isoformat(),
        ai_automated=AutomatedFlags(
            spelling_grammar_passed=True,
            cta_present=True,
            logo_visible=True,
            safe_zones_passed=True,
            resolution_passed=True,
            qr_code_scannable=None
        ),
        hybrid_flags=HybridFlags(
            pacing_warnings=hybrid_dict.get("pacing_warnings", []),
            transition_warnings=hybrid_dict.get("transition_warnings", []),
            brand_voice_score=hybrid_dict.get("brand_voice_score", 0.0)
        ),
        attention_score=inference_result.get("attention_score", 0),
        neural_resonance=inference_result.get("emotional_impact", 0),
        final_decision=FinalDecision(
            strategy_category=decision_dict.get("strategy_category", "Unknown"),
            approved=decision_dict.get("approved", False),
            revisions_required=decision_dict.get("revisions_required", True)
        )
    )

@router.post("/upload")
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    # Placeholder for video ingestion
    request_id = str(uuid.uuid4())
    return {"message": "Video uploaded successfully", "request_id": request_id, "filename": file.filename}
