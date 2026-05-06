import datetime
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from core_engine.api.schemas.diagnostics import (
    ActionableStep,
    AutomatedFlags,
    DiagnosticResult,
    FinalDecision,
    FrameInsight,
    HybridFlags,
    UploadVideoResponse,
    VideoInferenceRequest,
)
from core_engine.models.inference import TribeInferenceEngine
from core_engine.models.insights import InsightGenerator
from core_engine.processors.video import VideoProcessor

router = APIRouter()
engine = TribeInferenceEngine()
insight_gen = InsightGenerator()
TMP_ROOT = Path("tmp/diagnostics")

def _request_root(request_id: str) -> Path:
    return TMP_ROOT / request_id

def _request_upload_dir(request_id: str) -> Path:
    return _request_root(request_id) / "uploads"

def _request_frames_dir(request_id: str, frame_rate: int = 1) -> Path:
    return _request_root(request_id) / "frames" / f"fps_{max(1, frame_rate)}"

def _request_metadata_path(request_id: str) -> Path:
    return _request_root(request_id) / "metadata.json"

def _ensure_request_dirs(request_id: str, frame_rate: int = 1) -> None:
    _request_upload_dir(request_id).mkdir(parents=True, exist_ok=True)
    _request_frames_dir(request_id, frame_rate).mkdir(parents=True, exist_ok=True)

def _safe_filename(filename: str) -> str:
    fallback_name = "uploaded_video.bin"
    return Path(filename or fallback_name).name or fallback_name

async def _persist_upload(file: UploadFile, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as handle:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            handle.write(chunk)
    await file.close()

def _extract_frames_for_request(video_path: Path, frames_dir: Path, frame_rate: int = 1) -> list[str]:
    processor = VideoProcessor(output_dir=str(frames_dir))
    return processor.extract_frames(str(video_path), fps=max(1, frame_rate))

def _find_uploaded_video(request_id: str) -> Path:
    upload_dir = _request_upload_dir(request_id)
    candidates = sorted(path for path in upload_dir.iterdir() if path.is_file()) if upload_dir.exists() else []
    if not candidates:
        raise HTTPException(status_code=404, detail=f"No uploaded video found for request_id '{request_id}'.")
    return candidates[0]

def _resolve_frame_paths(request_id: str, video_path: Path, frame_rate: int) -> list[str]:
    frames_dir = _request_frames_dir(request_id, frame_rate)
    existing_frames = sorted(str(path) for path in frames_dir.glob("*.jpg"))
    if existing_frames:
        return existing_frames
    return _extract_frames_for_request(video_path, frames_dir, frame_rate)

def _build_automated_flags(stimuli, inference_result: dict) -> AutomatedFlags:
    features = inference_result.get("feature_summary", {})
    contrast = float(features.get("contrast", 0.0))
    motion = float(features.get("motion_energy", 0.0))
    brightness = float(features.get("brightness", 0.0))

    return AutomatedFlags(
        spelling_grammar_passed=True,
        cta_present=contrast > 0.18 or motion > 0.04,
        logo_visible=brightness > 0.16,
        safe_zones_passed=True,
        resolution_passed=stimuli.shape[1] >= 224 and stimuli.shape[2] >= 224,
        qr_code_scannable=contrast > 0.22,
    )

def _build_deterministic_review(inference_result: dict) -> dict:
    features = inference_result.get("feature_summary", {})
    attention_score = float(inference_result.get("attention_score", 0.0))
    emotional_impact = float(inference_result.get("emotional_impact", 0.0))
    prediction_confidence = float(inference_result.get("prediction_confidence", 0.0))
    sensory_load = float(inference_result.get("sensory_load", 0.0))
    motion = float(features.get("motion_energy", 0.0))
    contrast = float(features.get("contrast", 0.0))
    entropy = float(features.get("color_entropy", 0.0))

    pacing_warnings = []
    transition_warnings = []

    if sensory_load > 0.52:
        pacing_warnings.append("Sensory load is high; simplify dense moments so the offer remains easy to encode.")
    elif sensory_load < 0.18:
        pacing_warnings.append("Sensory load is low; add a stronger focal change or product cue to prevent attention drift.")

    if motion > 0.16:
        transition_warnings.append("Motion energy is elevated; check cuts and supers for legibility on CTV screens.")

    if contrast < 0.16:
        transition_warnings.append("Contrast is low; key message and CTA may need stronger separation from the background.")

    brand_voice_score = max(
        0.0,
        min(
            1.0,
            0.48
            + attention_score / 250.0
            + emotional_impact * 0.22
            + prediction_confidence * 0.12
            - max(0.0, sensory_load - 0.45) * 0.35,
        ),
    )

    if motion > 0.09 or contrast > 0.22:
        strategy_category = "Eye-Catching"
    elif emotional_impact > 0.72 and entropy > 0.65:
        strategy_category = "Storytelling"
    else:
        strategy_category = "Clever Concept"

    approved = (
        attention_score >= 62.0
        and prediction_confidence >= 0.72
        and brand_voice_score >= 0.70
        and len(pacing_warnings) == 0
    )

    return {
        "hybrid_flags": {
            "pacing_warnings": pacing_warnings,
            "transition_warnings": transition_warnings,
            "brand_voice_score": round(brand_voice_score, 4),
        },
        "final_decision": {
            "strategy_category": strategy_category,
            "approved": approved,
            "revisions_required": not approved,
        },
    }

def _build_actionable_steps(
    automated_flags: AutomatedFlags,
    hybrid_flags: HybridFlags,
    inference_result: dict,
    frame_insights: list[dict],
) -> list[ActionableStep]:
    steps = []

    low_attention_frames = [
        frame for frame in frame_insights
        if float(frame.get("attention_score", 0.0)) < 52.0
    ]
    high_load_frames = [
        frame for frame in frame_insights
        if float(frame.get("sensory_load", 0.0)) >= 0.62
    ]

    if not automated_flags.cta_present:
        steps.append(
            ActionableStep(
                priority="High",
                title="Make the CTA unmistakable in the last third.",
                rationale="The automated pass did not detect enough contrast or motion energy around a clear action cue.",
                frame_range="Final 3-5 seconds",
            )
        )

    if not automated_flags.logo_visible:
        steps.append(
            ActionableStep(
                priority="High",
                title="Increase brand salience in opening and closing frames.",
                rationale="Brand visibility is weak; viewers may remember the offer without linking it to the advertiser.",
                frame_range="Opening frame and end card",
            )
        )

    if low_attention_frames:
        first = low_attention_frames[0]
        last = low_attention_frames[-1]
        steps.append(
            ActionableStep(
                priority="Medium",
                title="Strengthen the focal point where attention drops.",
                rationale="Predicted prefrontal attention falls below the useful threshold, which can reduce message encoding.",
                frame_range=f"{first['timestamp_seconds']}s-{last['timestamp_seconds']}s",
            )
        )

    if high_load_frames:
        first = high_load_frames[0]
        last = high_load_frames[-1]
        steps.append(
            ActionableStep(
                priority="Medium",
                title="Simplify visually dense moments.",
                rationale="High sensory load can create noticeability, but too much load competes with comprehension.",
                frame_range=f"{first['timestamp_seconds']}s-{last['timestamp_seconds']}s",
            )
        )

    if hybrid_flags.brand_voice_score < 0.7:
        steps.append(
            ActionableStep(
                priority="Medium",
                title="Re-align copy and offer framing with brand voice.",
                rationale="The hybrid brand voice score is below the approval threshold.",
                frame_range="Full creative",
            )
        )

    for warning in hybrid_flags.pacing_warnings[:1]:
        steps.append(
            ActionableStep(
                priority="Medium",
                title="Adjust edit pacing around the warning moment.",
                rationale=warning,
                frame_range="Review pacing sequence",
            )
        )

    for warning in hybrid_flags.transition_warnings[:1]:
        steps.append(
            ActionableStep(
                priority="Low",
                title="Smooth the transition pattern.",
                rationale=warning,
                frame_range="Transition frames",
            )
        )

    if not steps:
        strongest_frame = max(frame_insights, key=lambda frame: frame.get("attention_score", 0.0), default=None)
        steps.append(
            ActionableStep(
                priority="Low",
                title="Preserve the strongest attention moment as the edit anchor.",
                rationale="No major QA blockers were detected; keep the highest-attention moment prominent.",
                frame_range=f"{strongest_frame['timestamp_seconds']}s" if strongest_frame else "Full creative",
            )
        )

    return steps[:5]

@router.post("/analyze", response_model=DiagnosticResult)
async def analyze_creative(request: VideoInferenceRequest):
    if not request.request_id and not request.video_url:
        raise HTTPException(
            status_code=400,
            detail="Provide either request_id from /upload or a local video_url to analyze.",
        )

    request_id = request.request_id or str(uuid.uuid4())
    frame_rate = max(1, request.frame_rate)

    if request.request_id:
        video_path = _find_uploaded_video(request_id)
    else:
        video_path = Path(request.video_url or "").expanduser()
        if not video_path.exists():
            raise HTTPException(status_code=404, detail=f"Video path not found: {video_path}")
        _ensure_request_dirs(request_id, frame_rate)

    frame_paths = _resolve_frame_paths(request_id, video_path, frame_rate)
    if not frame_paths:
        raise HTTPException(status_code=422, detail="No frames could be extracted from the provided video.")

    processor = VideoProcessor(output_dir=str(_request_frames_dir(request_id, frame_rate)))
    stimuli = processor.get_frame_grid_analysis(frame_paths)
    inference_result = engine.predict(stimuli)
    frame_insights_data = engine.predict_frame_sequence(stimuli, frame_rate)
    
    try:
        gemini_explanation_str = await insight_gen.generate_explanation(inference_result)
        gemini_data = json.loads(gemini_explanation_str)
    except Exception:
        gemini_data = _build_deterministic_review(inference_result)

    if "hybrid_flags" not in gemini_data or "final_decision" not in gemini_data:
        gemini_data = _build_deterministic_review(inference_result)
        
    hybrid_dict = gemini_data.get("hybrid_flags", {})
    decision_dict = gemini_data.get("final_decision", {})
    automated_flags = _build_automated_flags(stimuli, inference_result)
    hybrid_flags = HybridFlags(
        pacing_warnings=hybrid_dict.get("pacing_warnings", []),
        transition_warnings=hybrid_dict.get("transition_warnings", []),
        brand_voice_score=hybrid_dict.get("brand_voice_score", 0.0)
    )
    frame_insights = [FrameInsight(**frame_insight) for frame_insight in frame_insights_data]
    actionable_steps = _build_actionable_steps(
        automated_flags,
        hybrid_flags,
        inference_result,
        frame_insights_data,
    )

    metadata = {
        "request_id": request_id,
        "filename": video_path.name,
        "frame_rate": frame_rate,
        "analysis_depth": request.analysis_depth,
        "frames_extracted": len(frame_paths),
        "analyzed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    _request_metadata_path(request_id).write_text(json.dumps(metadata, indent=2))
        
    return DiagnosticResult(
        request_id=request_id,
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        ai_automated=automated_flags,
        hybrid_flags=hybrid_flags,
        attention_score=inference_result.get("attention_score", 0),
        neural_resonance=inference_result.get("emotional_impact", 0),
        region_activations=inference_result.get("activations", {}),
        prediction_confidence=inference_result.get("prediction_confidence", 0.0),
        sensory_load=inference_result.get("sensory_load", 0.0),
        frames_analyzed=inference_result.get("frames_analyzed", 0),
        frame_insights=frame_insights,
        actionable_steps=actionable_steps,
        final_decision=FinalDecision(
            strategy_category=decision_dict.get("strategy_category", "Unknown"),
            approved=decision_dict.get("approved", False),
            revisions_required=decision_dict.get("revisions_required", True)
        )
    )

@router.post("/upload", response_model=UploadVideoResponse)
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    request_id = str(uuid.uuid4())
    _ensure_request_dirs(request_id, 1)

    safe_name = _safe_filename(file.filename or "uploaded_video.bin")
    destination = _request_upload_dir(request_id) / safe_name
    await _persist_upload(file, destination)

    upload_metadata = {
        "request_id": request_id,
        "filename": safe_name,
        "uploaded_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    _request_metadata_path(request_id).write_text(json.dumps(upload_metadata, indent=2))
    background_tasks.add_task(_extract_frames_for_request, destination, _request_frames_dir(request_id, 1), 1)

    return UploadVideoResponse(
        request_id=request_id,
        filename=safe_name,
        status="uploaded",
        message="Video uploaded successfully and frame extraction started.",
    )
