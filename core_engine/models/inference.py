import numpy as np
from typing import Dict, Any, List
from PIL import Image

import cv2
import torch
import open_clip

# ---------------------------------------------------------------------------
# Text prompts for zero-shot CLIP scoring
# ---------------------------------------------------------------------------

_PROMPTS: Dict[str, Dict[str, List[str]]] = {
    "attention": {
        "pos": [
            "a visually striking advertisement with a clear focal point",
            "an eye-catching compelling scene that demands attention",
            "a bold vivid image with strong visual hierarchy",
        ],
        "neg": [
            "a boring dull unfocused scene",
            "a dark blurry unclear image with no focal point",
            "a bland visually uninteresting frame",
        ],
    },
    "emotional": {
        "pos": [
            "an emotionally powerful dramatic scene",
            "a joyful exciting energetic advertisement",
            "a scene that evokes strong feelings and emotion",
        ],
        "neg": [
            "a neutral calm emotionless scene",
            "a cold detached clinical image",
            "a flat unemotional photograph",
        ],
    },
    "sensory_load": {
        "pos": [
            "a visually complex busy cluttered scene with many elements",
            "an overwhelming chaotic frame with high visual density",
            "a fast-paced scene with multiple simultaneous elements",
        ],
        "neg": [
            "a clean minimal simple uncluttered advertisement",
            "a calm still scene with few elements",
            "a focused single-subject image with lots of negative space",
        ],
    },
    "visual_cortex": {
        "pos": [
            "a richly detailed colorful high-contrast visual scene",
            "a scene with vivid colors and complex textures",
        ],
        "neg": [
            "a plain monochrome simple image with few details",
        ],
    },
    "temporal_cortex": {
        "pos": [
            "a scene with fast movement rapid motion and dynamic action",
            "a high-energy kinetic advertisement with lots of movement",
        ],
        "neg": [
            "a completely still static motionless scene",
        ],
    },
}


class TribeInferenceEngine:
    """
    NeuralSeed Predictive Engine — CLIP-based zero-shot creative scoring.
    Uses ViT-B/32 visual embeddings to derive attention, emotion, and
    sensory load scores via text-image alignment.
    Falls back to pixel-level heuristics if CLIP is unavailable.
    """

    CLIP_MODEL = "ViT-B-32"
    CLIP_PRETRAINED = "openai"

    def __init__(self, model_version: str = "v2-stable"):
        self.model_version = model_version
        self.brain_regions = [
            "Visual Cortex (V1-V4)",
            "Auditory Cortex (Temporal)",
            "Amygdala (Emotional)",
            "Prefrontal Cortex (Attention)",
        ]
        self._clip_model = None
        self._clip_preprocess = None
        self._text_features: Dict[str, torch.Tensor] = {}
        self._clip_ready = False
        self._load_clip()

    # ------------------------------------------------------------------
    # CLIP loading
    # ------------------------------------------------------------------

    def _load_clip(self) -> None:
        try:
            model, _, preprocess = open_clip.create_model_and_transforms(
                self.CLIP_MODEL, pretrained=self.CLIP_PRETRAINED
            )
            model.eval()
            self._clip_model = model
            self._clip_preprocess = preprocess
            tokenizer = open_clip.get_tokenizer(self.CLIP_MODEL)
            self._text_features = self._encode_all_prompts(tokenizer)
            self._clip_ready = True
        except Exception:
            self._clip_ready = False

    def _encode_all_prompts(self, tokenizer) -> Dict[str, torch.Tensor]:
        encoded: Dict[str, torch.Tensor] = {}
        with torch.no_grad():
            for key, sides in _PROMPTS.items():
                for side, texts in sides.items():
                    tokens = tokenizer(texts)
                    feats = self._clip_model.encode_text(tokens)
                    feats = feats / feats.norm(dim=-1, keepdim=True)
                    encoded[f"{key}_{side}"] = feats.mean(dim=0)
        return encoded

    # ------------------------------------------------------------------
    # CLIP scoring helpers
    # ------------------------------------------------------------------

    def _clip_score(self, image_feat: torch.Tensor, key: str) -> float:
        """Zero-shot score: P(positive | image) using softmax over pos/neg."""
        pos = self._text_features[f"{key}_pos"]
        neg = self._text_features[f"{key}_neg"]
        pos_sim = (image_feat @ pos).squeeze()
        neg_sim = (image_feat @ neg).squeeze()
        logits = torch.stack([pos_sim, neg_sim]) * 100.0
        probs = torch.softmax(logits, dim=0)
        return float(probs[0].clamp(0.0, 1.0))

    def _encode_frames(self, stimuli: np.ndarray) -> torch.Tensor:
        """Encode a batch of frames (N, H, W, 3) float32 [0,1] → mean CLIP embedding."""
        imgs = []
        for frame in stimuli:
            pil = Image.fromarray((frame * 255).astype(np.uint8))
            imgs.append(self._clip_preprocess(pil))
        batch = torch.stack(imgs)
        with torch.no_grad():
            feats = self._clip_model.encode_image(batch)
            feats = feats / feats.norm(dim=-1, keepdim=True)
        return feats.mean(dim=0, keepdim=True)  # (1, D)

    # ------------------------------------------------------------------
    # Pixel-level fallback (used when CLIP unavailable)
    # ------------------------------------------------------------------

    @staticmethod
    def _clamp01(value: float) -> float:
        return float(np.clip(value, 0.0, 1.0))

    def _compute_pixel_features(self, stimuli: np.ndarray) -> Dict[str, float]:
        frames = stimuli.astype(np.float32)
        luminance = (
            0.2126 * frames[..., 0]
            + 0.7152 * frames[..., 1]
            + 0.0722 * frames[..., 2]
        )
        contrast = float(np.std(luminance))
        edge_h = np.abs(np.diff(luminance, axis=2)).mean()
        edge_v = np.abs(np.diff(luminance, axis=1)).mean()
        edge_density = float((edge_h + edge_v) / 2.0)
        motion_energy = float(np.abs(np.diff(frames, axis=0)).mean()) if len(frames) > 1 else 0.0
        temporal_variance = float(np.std(frames.mean(axis=(1, 2, 3)))) if len(frames) > 1 else 0.0
        color_balance = float(np.std(frames.mean(axis=(0, 1, 2))))
        saturation = float((frames.max(axis=-1) - frames.min(axis=-1)).mean())
        brightness = float(np.mean(luminance))
        hist, _ = np.histogram(luminance, bins=16, range=(0.0, 1.0), density=False)
        hist = hist.astype(np.float32)
        hist = hist[hist > 0]
        p = hist / hist.sum() if hist.size else hist
        entropy = float(-np.sum(p * np.log2(p)) / np.log2(16)) if p.size else 0.0
        return {
            "contrast": round(contrast, 6),
            "edge_density": round(edge_density, 6),
            "motion_energy": round(motion_energy, 6),
            "temporal_variance": round(temporal_variance, 6),
            "color_balance": round(color_balance, 6),
            "saturation": round(saturation, 6),
            "brightness": round(brightness, 6),
            "color_entropy": round(0.0 if abs(entropy) < 1e-9 else entropy, 6),
        }

    def _predict_from_pixels(self, stimuli: np.ndarray) -> Dict[str, Any]:
        f = self._compute_pixel_features(stimuli)
        visual = self._clamp01(0.12 + f["contrast"] * 2.0 + f["edge_density"] * 2.4 + f["brightness"] * 0.35)
        auditory = self._clamp01(0.08 + f["motion_energy"] * 3.2 + f["temporal_variance"] * 2.1)
        amygdala = self._clamp01(0.10 + f["color_entropy"] * 0.65 + f["saturation"] * 0.80 + f["motion_energy"] * 1.4)
        prefrontal = self._clamp01(0.15 + f["contrast"] * 1.8 + f["motion_energy"] * 2.0 + f["edge_density"] * 1.1)
        activations = {
            "Visual Cortex (V1-V4)": round(visual, 4),
            "Auditory Cortex (Temporal)": round(auditory, 4),
            "Amygdala (Emotional)": round(amygdala, 4),
            "Prefrontal Cortex (Attention)": round(prefrontal, 4),
        }
        sensory_load = float(np.mean([f["contrast"], f["edge_density"], f["motion_energy"], f["saturation"], f["color_entropy"]]))
        attention_score = round(prefrontal * 100.0, 2)
        prediction_confidence = self._clamp01(0.55 + min(stimuli.shape[0], 24) / 40.0 + sensory_load * 0.4)
        return {
            "activations": activations,
            "attention_score": attention_score,
            "emotional_impact": round(amygdala, 4),
            "sensory_load": round(sensory_load, 4),
            "prediction_confidence": round(prediction_confidence, 4),
            "feature_summary": f,
            "frames_analyzed": int(stimuli.shape[0]),
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def predict(self, stimuli: np.ndarray) -> Dict[str, Any]:
        """
        Score a sequence of frames using CLIP zero-shot alignment.
        Falls back to pixel heuristics if CLIP is unavailable.
        """
        if stimuli.ndim != 4 or stimuli.shape[-1] != 3:
            raise ValueError("Stimuli must have shape (frames, H, W, 3).")

        if not self._clip_ready:
            return self._predict_from_pixels(stimuli)

        image_feat = self._encode_frames(stimuli)  # (1, D)

        attention = self._clip_score(image_feat, "attention")
        emotional = self._clip_score(image_feat, "emotional")
        sensory_load = self._clip_score(image_feat, "sensory_load")
        visual_act = self._clip_score(image_feat, "visual_cortex")
        temporal_act = self._clip_score(image_feat, "temporal_cortex")

        activations = {
            "Visual Cortex (V1-V4)": round(visual_act, 4),
            "Auditory Cortex (Temporal)": round(temporal_act, 4),
            "Amygdala (Emotional)": round(emotional, 4),
            "Prefrontal Cortex (Attention)": round(attention, 4),
        }

        attention_score = round(attention * 100.0, 2)
        n_frames = int(stimuli.shape[0])
        prediction_confidence = self._clamp01(0.60 + min(n_frames, 30) / 50.0)

        return {
            "activations": activations,
            "attention_score": attention_score,
            "emotional_impact": round(emotional, 4),
            "sensory_load": round(sensory_load, 4),
            "prediction_confidence": round(prediction_confidence, 4),
            "feature_summary": {},
            "frames_analyzed": n_frames,
        }

    def predict_frame_sequence(self, stimuli: np.ndarray, frame_rate: float = 1.0) -> List[Dict[str, Any]]:
        """Score each frame individually."""
        insights = []
        for frame_index, frame in enumerate(stimuli):
            result = self.predict(frame[np.newaxis, ...])
            activations = result["activations"]
            dominant_region = max(activations, key=activations.get)
            attention_score = float(result["attention_score"])
            emotional_response = float(result["emotional_impact"])
            sensory_load = float(result["sensory_load"])

            if attention_score >= 72:
                cognitive_response = "High attention lock: the frame is likely to hold focus."
            elif attention_score >= 52:
                cognitive_response = "Moderate attention: the frame supports comprehension but can work harder."
            else:
                cognitive_response = "Low attention risk: viewers may drift or miss the message."

            if sensory_load >= 0.62:
                recommendation = "Reduce visual clutter or slow the transition around this moment."
            elif attention_score < 52:
                recommendation = "Add a clearer focal point, product cue, or CTA reinforcement."
            elif emotional_response < 0.45:
                recommendation = "Increase emotional salience with a stronger human, product, or offer cue."
            else:
                recommendation = "Keep this moment as a structural anchor for the edit."

            map_type = "low-attention" if attention_score < 75 else "high-load"
            insights.append({
                "frame_index": frame_index,
                "timestamp_seconds": round(frame_index / max(0.1, frame_rate), 2),
                "dominant_region": dominant_region,
                "attention_score": round(attention_score, 2),
                "emotional_response": round(emotional_response, 4),
                "sensory_load": round(sensory_load, 4),
                "cognitive_response": cognitive_response,
                "recommendation": recommendation,
                "attention_map": self.compute_spatial_heatmap(frame, map_type),
            })

        return insights

    def compute_spatial_heatmap(
        self, frame: np.ndarray, map_type: str, grid: int = 14
    ) -> List[List[float]]:
        """
        Compute a grid×grid spatial saliency map for a single frame.
        - map_type 'high-load'     : cells with highest visual complexity (edges + variance + saturation).
        - map_type 'low-attention' : cells with lowest visual salience (inverted complexity map).
        frame: (H, W, 3) float32 in [0, 1].
        Returns a grid×grid list of floats in [0, 1].
        """
        try:
            h, w = frame.shape[:2]
            lum = (0.2126 * frame[..., 0] + 0.7152 * frame[..., 1] + 0.0722 * frame[..., 2])
            lum_u8 = (lum * 255).astype(np.uint8)
            grad_x = cv2.Sobel(lum_u8, cv2.CV_32F, 1, 0, ksize=3)
            grad_y = cv2.Sobel(lum_u8, cv2.CV_32F, 0, 1, ksize=3)
            grad_mag = np.sqrt(grad_x ** 2 + grad_y ** 2) / 1448.0
            sat = frame.max(axis=-1) - frame.min(axis=-1)

            cell_h = h / grid
            cell_w = w / grid
            raw: List[List[float]] = []
            for r in range(grid):
                row_vals: List[float] = []
                for c in range(grid):
                    r0, r1 = int(r * cell_h), max(int(r * cell_h) + 1, int((r + 1) * cell_h))
                    c0, c1 = int(c * cell_w), max(int(c * cell_w) + 1, int((c + 1) * cell_w))
                    score = (
                        float(grad_mag[r0:r1, c0:c1].mean()) * 0.5
                        + float(lum[r0:r1, c0:c1].std()) * 0.3
                        + float(sat[r0:r1, c0:c1].mean()) * 0.2
                    )
                    row_vals.append(score)
                raw.append(row_vals)

            flat = [v for row in raw for v in row]
            vmin, vmax = min(flat), max(flat)
            if vmax - vmin < 1e-6:
                return [[0.0] * grid for _ in range(grid)]

            normalized = [
                [round((v - vmin) / (vmax - vmin), 4) for v in row]
                for row in raw
            ]
            if map_type == "low-attention":
                normalized = [[round(1.0 - v, 4) for v in row] for row in normalized]
            return normalized
        except Exception:
            return [[0.0] * grid for _ in range(grid)]

    def get_voxel_heatmap(self) -> List[List[float]]:
        return [
            [round((np.sin((r + 1) * (c + 1) / 4.0) + 1.0) / 2.0, 4) for c in range(10)]
            for r in range(10)
        ]
