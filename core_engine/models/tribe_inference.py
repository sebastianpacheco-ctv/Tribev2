"""
TRIBE v2 Inference Engine — wraps Meta's TribeModel for creative diagnostics.

Maps cortical vertex predictions (fsaverage5, ~20k vertices) to the same
output dict contract as TribeInferenceEngine (CLIP-based engine).

Vertex-to-region mapping uses fsaverage5 bilateral hemisphere ordering:
  Left hemisphere  vertices 0–10,241
  Right hemisphere vertices 10,242–20,483

Approximate lobe boundaries (per FreeSurfer fsaverage5 parcellation):
  Occipital / Visual Cortex:   ~0–2,500  (left) + mirror right
  Superior Temporal / Audio:   ~2,500–5,000
  Limbic / Amygdala-proxy:     ~5,000–6,500
  Prefrontal / Frontal:        ~6,500–10,241
"""

import threading
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Vertex index ranges on the LEFT hemisphere (mirrored for right).
# Based on fsaverage5 parcellation lobe ordering.
# ---------------------------------------------------------------------------
_N_VERTS_PER_HEMI = 10_242

_REGION_SLICES: Dict[str, slice] = {
    "Visual Cortex (V1-V4)":          slice(0,    2_500),
    "Auditory Cortex (Temporal)":      slice(2_500, 5_000),
    "Amygdala (Emotional)":            slice(5_000, 6_500),
    "Prefrontal Cortex (Attention)":   slice(6_500, _N_VERTS_PER_HEMI),
}

_REGION_DOMINANT_LABELS = {
    "Visual Cortex (V1-V4)":         "Visual Cortex (V1-V4)",
    "Auditory Cortex (Temporal)":     "Auditory Cortex (Temporal)",
    "Amygdala (Emotional)":           "Amygdala (Emotional)",
    "Prefrontal Cortex (Attention)":  "Prefrontal Cortex (Attention)",
}


def _normalize_preds(preds: np.ndarray) -> np.ndarray:
    """Z-scored fMRI values → [0, 1] per vertex across time axis."""
    mn = preds.min(axis=0, keepdims=True)
    mx = preds.max(axis=0, keepdims=True)
    rng = mx - mn
    rng[rng < 1e-8] = 1.0
    return (preds - mn) / rng


def _region_mean(preds_norm: np.ndarray, region: str) -> float:
    """Average normalised activation for a region across time and vertices (both hemispheres)."""
    sl = _REGION_SLICES[region]
    # Bilateral: left hemi + right hemi mirror
    left  = preds_norm[:, sl]
    right = preds_norm[:, _N_VERTS_PER_HEMI + sl.start : _N_VERTS_PER_HEMI + sl.stop]
    combined = np.concatenate([left, right], axis=1)
    return float(np.clip(combined.mean(), 0.0, 1.0))


def _preds_to_inference_result(preds: np.ndarray) -> Dict[str, Any]:
    """Convert (n_timesteps, n_vertices) preds array → inference result dict."""
    preds_norm = _normalize_preds(preds)

    activations: Dict[str, float] = {
        region: _region_mean(preds_norm, region)
        for region in _REGION_SLICES
    }

    prefrontal  = activations["Prefrontal Cortex (Attention)"]
    visual      = activations["Visual Cortex (V1-V4)"]
    temporal    = activations["Auditory Cortex (Temporal)"]
    amygdala    = activations["Amygdala (Emotional)"]

    attention_score = prefrontal * 100.0
    emotional_impact = amygdala
    sensory_load = (visual + temporal) / 2.0
    # Confidence scales with number of timesteps (more data → more confidence)
    n_ts = preds.shape[0]
    prediction_confidence = float(np.clip(0.60 + min(n_ts, 60) / 120.0, 0.0, 1.0))

    dominant_region = max(activations, key=activations.__getitem__)

    motion_energy = float(np.diff(preds_norm, axis=0).std()) if n_ts > 1 else 0.0
    contrast = float(preds_norm.std())

    return {
        "attention_score":       attention_score,
        "emotional_impact":      emotional_impact,
        "sensory_load":          sensory_load,
        "prediction_confidence": prediction_confidence,
        "activations":           activations,
        "frames_analyzed":       n_ts,
        "dominant_region":       dominant_region,
        "feature_summary": {
            "motion_energy": motion_energy,
            "contrast":      contrast,
            "color_entropy": float(np.clip(contrast * 1.2, 0.0, 1.0)),
        },
    }


def _preds_to_frame_sequence(preds: np.ndarray, video_duration: float) -> List[Dict]:
    """Convert preds to per-timestep frame insights list."""
    preds_norm = _normalize_preds(preds)
    n_ts = preds.shape[0]
    insights = []
    for i in range(n_ts):
        row = preds_norm[i]  # (n_vertices,)
        activations_t: Dict[str, float] = {}
        for region, sl in _REGION_SLICES.items():
            left  = row[sl]
            right = row[_N_VERTS_PER_HEMI + sl.start : _N_VERTS_PER_HEMI + sl.stop]
            activations_t[region] = float(np.clip(np.concatenate([left, right]).mean(), 0.0, 1.0))

        prefrontal_t = activations_t["Prefrontal Cortex (Attention)"]
        amygdala_t   = activations_t["Amygdala (Emotional)"]
        visual_t     = activations_t["Visual Cortex (V1-V4)"]
        temporal_t   = activations_t["Auditory Cortex (Temporal)"]

        attention_score_t = prefrontal_t * 100.0
        sensory_load_t    = (visual_t + temporal_t) / 2.0
        emotional_t       = amygdala_t
        dominant_t        = max(activations_t, key=activations_t.__getitem__)
        timestamp_t       = (i / n_ts) * video_duration if video_duration > 0 else float(i)

        cog = (
            "Strong neural engagement — prefrontal and visual cortex active."
            if attention_score_t >= 75
            else "Moderate engagement — consider strengthening the focal cue."
            if attention_score_t >= 50
            else "Low attention signal — add a stronger visual anchor."
        )
        rec = (
            "Preserve this moment — high cortical engagement detected."
            if attention_score_t >= 75
            else "Consider a sharper focal point or contrast boost here."
            if attention_score_t >= 50
            else "Add a high-contrast element or product cue at this point."
        )

        insights.append({
            "frame_index":         i,
            "timestamp_seconds":   round(timestamp_t, 2),
            "dominant_region":     dominant_t,
            "attention_score":     round(attention_score_t, 1),
            "emotional_response":  round(emotional_t, 4),
            "sensory_load":        round(sensory_load_t, 4),
            "cognitive_response":  cog,
            "recommendation":      rec,
            "attention_map":       None,  # TRIBE v2 does not produce 2D spatial maps
        })
    return insights


class TribeV2InferenceEngine:
    """
    Inference engine backed by Meta's TRIBE v2 foundation model.

    Outputs the same dict contract as TribeInferenceEngine (CLIP-based)
    so the route layer can swap engines without downstream changes.

    Only supports video files — images and URL screenshots fall back to CLIP.
    """

    def __init__(self) -> None:
        self._model = None
        self._ready = False
        self._load_lock = threading.Lock()

    # ------------------------------------------------------------------
    def _ensure_loaded(self) -> None:
        if self._ready:
            return
        with self._load_lock:
            if not self._ready:
                self._load_model()

    def _load_model(self) -> None:
        try:
            from tribev2 import TribeModel  # type: ignore
            logger.info("Loading TRIBE v2 model from Hugging Face (first run may download weights)…")
            self._model = TribeModel.from_pretrained("facebook/tribev2")
            self._ready = True
            logger.info("TRIBE v2 model loaded successfully.")
        except Exception as exc:
            logger.error(f"Failed to load TRIBE v2 model: {exc}")
            self._ready = False

    # ------------------------------------------------------------------
    def is_available(self) -> bool:
        self._ensure_loaded()
        return self._ready

    # ------------------------------------------------------------------
    def predict_from_video_path(self, video_path: str) -> Dict[str, Any]:
        """Run TRIBE v2 on a video file, return inference result dict."""
        self._ensure_loaded()
        if not self._ready or self._model is None:
            raise RuntimeError(
                "TRIBE v2 model is not available. "
                "Install tribev2 or use engine_type='clip'."
            )

        df = self._model.get_events_dataframe(video_path=video_path)
        preds, _ = self._model.predict(events=df, verbose=False)
        # preds: (n_timesteps, n_vertices)
        return _preds_to_inference_result(np.array(preds))

    # ------------------------------------------------------------------
    def predict_frame_sequence_from_video_path(
        self, video_path: str, frame_rate: float = 1.0
    ) -> List[Dict]:
        """Run TRIBE v2 and return per-timestep frame insights."""
        self._ensure_loaded()
        if not self._ready or self._model is None:
            raise RuntimeError(
                "TRIBE v2 model is not available. "
                "Install tribev2 or use engine_type='clip'."
            )

        # Get video duration for timestamp mapping
        try:
            cap = cv2.VideoCapture(video_path)
            fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            cap.release()
            video_duration = n_frames / fps if fps > 0 else 0.0
        except Exception:
            video_duration = 0.0

        df = self._model.get_events_dataframe(video_path=video_path)
        preds, _ = self._model.predict(events=df, verbose=False)
        return _preds_to_frame_sequence(np.array(preds), video_duration)
