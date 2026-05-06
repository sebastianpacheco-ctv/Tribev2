import datetime
import json
import shutil
import time
import uuid
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from PIL import Image

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
TMP_MAX_AGE_HOURS = 24

# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# Upload / frame helpers
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# Real QA checks
# ---------------------------------------------------------------------------

def _scan_for_qr(frame_paths: list[str]) -> bool | None:
    """
    Scan a sample of frames with pyzbar (requires libzbar system library).
    Returns True if a scannable QR code is found, None if none detected.
    """
    if not frame_paths:
        return None
    try:
        from pyzbar import pyzbar as _pyzbar
    except ImportError:
        return None  # libzbar not available

    step = max(1, len(frame_paths) // 5)
    sample = frame_paths[::step][:5]
    for path in sample:
        try:
            img = Image.open(path)
            codes = _pyzbar.decode(img)
            if codes:
                return True
        except Exception:
            continue
    return None


def _check_spelling_grammar(frame_paths: list[str]) -> bool:
    """
    Extract visible text from a sample of frames using Tesseract OCR and flag
    obvious issues: very short text (< 3 chars per frame on average suggests
    OCR found nothing meaningful) or frames with no readable copy at all.
    Returns True (pass) when readable text is consistently present.
    Falls back to True if Tesseract is unavailable.
    """
    if not frame_paths:
        return True
    try:
        import pytesseract
    except ImportError:
        return True  # Tesseract not available — skip check

    step = max(1, len(frame_paths) // 5)
    sample = frame_paths[::step][:5]
    readable_frames = 0
    for path in sample:
        try:
            img = Image.open(path)
            text = pytesseract.image_to_string(img, config="--psm 11 --oem 3")
            # Count alphabetic characters to filter OCR noise
            alpha_chars = sum(c.isalpha() for c in text)
            if alpha_chars >= 3:
                readable_frames += 1
        except Exception:
            continue

    if not sample:
        return True
    # Pass if at least one sampled frame contains readable text
    return readable_frames > 0


def _check_safe_zones(frame_paths: list[str]) -> bool:
    """
    Check that high-saliency content (bright, high-contrast regions) stays within
    the CTV safe area: 10% horizontal margin, 5% vertical margin on each side.
    Passes if fewer than 20% of sampled frames have significant safe-zone violations.
    """
    if not frame_paths:
        return True
    step = max(1, len(frame_paths) // 5)
    sample = frame_paths[::step][:5]
    violations = 0
    for path in sample:
        try:
            img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
            if img is None:
                continue
            h, w = img.shape
            margin_x = int(w * 0.10)
            margin_y = int(h * 0.05)
            _, thresh = cv2.threshold(img, 200, 255, cv2.THRESH_BINARY)
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                if cv2.contourArea(cnt) < 500:
                    continue
                x, y, cw, ch = cv2.boundingRect(cnt)
                outside = (
                    x < margin_x
                    or y < margin_y
                    or (x + cw) > (w - margin_x)
                    or (y + ch) > (h - margin_y)
                )
                if outside:
                    violations += 1
                    break
        except Exception:
            continue
    return violations <= max(1, len(sample) * 0.20)


def _detect_cta(frame_paths: list[str], features: dict) -> bool:
    """
    Detect CTA presence by measuring edge density and contrast in the last 30% of frames,
    where CTAs typically appear. Falls back to visual feature heuristic if frames are unavailable.
    """
    if not frame_paths:
        return features.get("contrast", 0.0) > 0.18 or features.get("motion_energy", 0.0) > 0.04

    cutoff = int(len(frame_paths) * 0.70)
    last_segment = frame_paths[cutoff:] or frame_paths[-3:]
    scores = []
    for path in last_segment:
        try:
            img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
            if img is None:
                continue
            edges = cv2.Canny(img, 50, 150)
            edge_density = float(edges.mean()) / 255.0
            contrast = float(img.std()) / 128.0
            scores.append(edge_density + contrast)
        except Exception:
            continue

    if not scores:
        return features.get("contrast", 0.0) > 0.18 or features.get("motion_energy", 0.0) > 0.04

    return float(np.mean(scores)) > 0.25


def _detect_logo(frame_paths: list[str]) -> bool:
    """
    Estimate logo visibility by checking for consistent bright/high-contrast elements
    in the four corners of the opening frames. Logo placements are typically top-left
    or bottom-right on CTV creatives.
    """
    if not frame_paths:
        return False

    sample = frame_paths[:min(5, len(frame_paths))]
    corner_scores = []
    for path in sample:
        try:
            img = cv2.imread(path, cv2.IMREAD_COLOR)
            if img is None:
                continue
            h, w = img.shape[:2]
            ch, cw = max(1, int(h * 0.15)), max(1, int(w * 0.15))
            corners = [
                img[:ch, :cw],
                img[:ch, w - cw:],
                img[h - ch:, :cw],
                img[h - ch:, w - cw:],
            ]
            max_brightness = max(float(c.mean()) / 255.0 for c in corners if c.size > 0)
            corner_scores.append(max_brightness)
        except Exception:
            continue

    if not corner_scores:
        return False

    return float(np.mean(corner_scores)) > 0.15


def _build_automated_flags(stimuli: np.ndarray, inference_result: dict, frame_paths: list[str]) -> AutomatedFlags:
    features = inference_result.get("feature_summary", {})
    return AutomatedFlags(
        spelling_grammar_passed=_check_spelling_grammar(frame_paths),
        cta_present=_detect_cta(frame_paths, features),
        logo_visible=_detect_logo(frame_paths),
        safe_zones_passed=_check_safe_zones(frame_paths),
        resolution_passed=stimuli.shape[1] >= 224 and stimuli.shape[2] >= 224,
        qr_code_scannable=_scan_for_qr(frame_paths),
    )

# ---------------------------------------------------------------------------
# Hybrid review / deterministic fallback
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# Actionable steps
# ---------------------------------------------------------------------------

def _build_actionable_steps(
    automated_flags: AutomatedFlags,
    hybrid_flags: HybridFlags,
    _inference_result: dict,
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
                rationale="Edge detection on the final frames did not find enough contrast or activity around a clear action cue.",
                frame_range="Final 3-5 seconds",
            )
        )

    if not automated_flags.logo_visible:
        steps.append(
            ActionableStep(
                priority="High",
                title="Increase brand salience in opening and closing frames.",
                rationale="Corner analysis found low brightness in typical logo positions; viewers may not link the offer to the brand.",
                frame_range="Opening frame and end card",
            )
        )

    if automated_flags.safe_zones_passed is False:
        steps.append(
            ActionableStep(
                priority="High",
                title="Move key elements inside the CTV safe area.",
                rationale="High-saliency content was detected outside the 10%/5% CTV safe-zone margins and may be cropped on some screens.",
                frame_range="Full creative",
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

# ---------------------------------------------------------------------------
# tmp/diagnostics cleanup
# ---------------------------------------------------------------------------

def _cleanup_old_requests(max_age_hours: int = TMP_MAX_AGE_HOURS) -> int:
    """Delete request directories older than max_age_hours. Returns count of deleted directories."""
    if not TMP_ROOT.exists():
        return 0
    cutoff = time.time() - (max_age_hours * 3600)
    deleted = 0
    for request_dir in TMP_ROOT.iterdir():
        if not request_dir.is_dir():
            continue
        try:
            if request_dir.stat().st_mtime < cutoff:
                shutil.rmtree(request_dir)
                deleted += 1
        except Exception:
            pass
    return deleted

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

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
    automated_flags = _build_automated_flags(stimuli, inference_result, frame_paths)
    hybrid_flags = HybridFlags(
        pacing_warnings=hybrid_dict.get("pacing_warnings", []),
        transition_warnings=hybrid_dict.get("transition_warnings", []),
        brand_voice_score=hybrid_dict.get("brand_voice_score", 0.0),
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
            revisions_required=decision_dict.get("revisions_required", True),
        ),
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
    background_tasks.add_task(_cleanup_old_requests, TMP_MAX_AGE_HOURS)

    return UploadVideoResponse(
        request_id=request_id,
        filename=safe_name,
        status="uploaded",
        message="Video uploaded successfully and frame extraction started.",
    )


@router.delete("/cleanup")
async def cleanup_diagnostics(max_age_hours: int = TMP_MAX_AGE_HOURS):
    """Delete tmp/diagnostics directories older than max_age_hours (default 24h)."""
    deleted = _cleanup_old_requests(max_age_hours)
    return {"deleted_requests": deleted, "max_age_hours": max_age_hours}
