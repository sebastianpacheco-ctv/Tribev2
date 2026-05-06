import numpy as np
from typing import Dict, Any, List

class TribeInferenceEngine:
    """
    Wrapper for the TRIBE v2 Predictive Foundation Model.
    Currently simulates brain-inspired predictive inference on creative stimuli.
    """
    def __init__(self, model_version: str = "v2-stable"):
        self.model_version = model_version
        self.brain_regions = [
            "Visual Cortex (V1-V4)",
            "Auditory Cortex (Temporal)",
            "Amygdala (Emotional)",
            "Prefrontal Cortex (Attention)"
        ]

    @staticmethod
    def _clamp01(value: float) -> float:
        return float(np.clip(value, 0.0, 1.0))

    def _compute_features(self, stimuli: np.ndarray) -> Dict[str, float]:
        if stimuli.ndim != 4 or stimuli.shape[-1] != 3:
            raise ValueError("Stimuli must have shape (frames, height, width, 3).")

        frames = stimuli.astype(np.float32)
        luminance = (
            0.2126 * frames[..., 0]
            + 0.7152 * frames[..., 1]
            + 0.0722 * frames[..., 2]
        )

        contrast = float(np.std(luminance))
        edge_horizontal = np.abs(np.diff(luminance, axis=2)).mean()
        edge_vertical = np.abs(np.diff(luminance, axis=1)).mean()
        edge_density = float((edge_horizontal + edge_vertical) / 2.0)

        if len(frames) > 1:
            motion_energy = float(np.abs(np.diff(frames, axis=0)).mean())
            temporal_variance = float(np.std(frames.mean(axis=(1, 2, 3))))
        else:
            motion_energy = 0.0
            temporal_variance = 0.0

        mean_colors = frames.mean(axis=(0, 1, 2))
        color_balance = float(np.std(mean_colors))
        saturation = float((frames.max(axis=-1) - frames.min(axis=-1)).mean())
        brightness = float(np.mean(luminance))

        histogram, _ = np.histogram(luminance, bins=16, range=(0.0, 1.0), density=False)
        histogram = histogram.astype(np.float32)
        histogram = histogram[histogram > 0]
        probability_distribution = histogram / histogram.sum() if histogram.size else histogram
        color_entropy = (
            float(-np.sum(probability_distribution * np.log2(probability_distribution)) / np.log2(16))
            if probability_distribution.size
            else 0.0
        )

        normalized_entropy = 0.0 if abs(color_entropy) < 1e-9 else round(color_entropy, 6)

        return {
            "contrast": round(contrast, 6),
            "edge_density": round(edge_density, 6),
            "motion_energy": round(motion_energy, 6),
            "temporal_variance": round(temporal_variance, 6),
            "color_balance": round(color_balance, 6),
            "saturation": round(saturation, 6),
            "brightness": round(brightness, 6),
            "color_entropy": normalized_entropy,
        }

    def predict(self, stimuli: np.ndarray) -> Dict[str, Any]:
        """
        Derives deterministic neural-style scores from pixel-level video features.
        """
        features = self._compute_features(stimuli)

        visual_activation = self._clamp01(
            0.12
            + features["contrast"] * 2.0
            + features["edge_density"] * 2.4
            + features["brightness"] * 0.35
        )
        auditory_activation = self._clamp01(
            0.08
            + features["motion_energy"] * 3.2
            + features["temporal_variance"] * 2.1
        )
        amygdala_activation = self._clamp01(
            0.10
            + features["color_entropy"] * 0.65
            + features["saturation"] * 0.80
            + features["motion_energy"] * 1.4
            + abs(features["brightness"] - 0.5) * 0.35
            + features["brightness"] * 0.20
        )
        prefrontal_activation = self._clamp01(
            0.15
            + features["contrast"] * 1.8
            + features["motion_energy"] * 2.0
            + features["edge_density"] * 1.1
            + features["color_balance"] * 1.5
            + features["brightness"] * 0.25
        )

        activations = {
            "Visual Cortex (V1-V4)": round(visual_activation, 4),
            "Auditory Cortex (Temporal)": round(auditory_activation, 4),
            "Amygdala (Emotional)": round(amygdala_activation, 4),
            "Prefrontal Cortex (Attention)": round(prefrontal_activation, 4),
        }
        
        attention_score = round(activations["Prefrontal Cortex (Attention)"] * 100.0, 2)
        emotional_impact = activations["Amygdala (Emotional)"]
        sensory_load = float(
            np.mean(
                [
                    features["contrast"],
                    features["edge_density"],
                    features["motion_energy"],
                    features["saturation"],
                    features["color_entropy"],
                ]
            )
        )
        prediction_confidence = self._clamp01(
            0.55 + min(int(stimuli.shape[0]), 24) / 40.0 + sensory_load * 0.4
        )
        
        return {
            "activations": activations,
            "attention_score": attention_score,
            "emotional_impact": emotional_impact,
            "sensory_load": round(sensory_load, 4),
            "prediction_confidence": round(prediction_confidence, 4),
            "feature_summary": features,
            "frames_analyzed": int(stimuli.shape[0]),
        }

    def predict_frame_sequence(self, stimuli: np.ndarray, frame_rate: int = 1) -> List[Dict[str, Any]]:
        """
        Derives deterministic frame-level neural-style responses.
        """
        insights = []
        sample_rate = max(1, frame_rate)

        for frame_index, frame in enumerate(stimuli):
            frame_result = self.predict(frame[np.newaxis, ...])
            activations = frame_result["activations"]
            dominant_region = max(activations, key=activations.get)
            attention_score = float(frame_result["attention_score"])
            emotional_response = float(frame_result["emotional_impact"])
            sensory_load = float(frame_result["sensory_load"])

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

            insights.append(
                {
                    "frame_index": frame_index,
                    "timestamp_seconds": round(frame_index / sample_rate, 2),
                    "dominant_region": dominant_region,
                    "attention_score": round(attention_score, 2),
                    "emotional_response": round(emotional_response, 4),
                    "sensory_load": round(sensory_load, 4),
                    "cognitive_response": cognitive_response,
                    "recommendation": recommendation,
                }
            )

        return insights

    def get_voxel_heatmap(self) -> List[List[float]]:
        """
        Generates a deterministic voxel-level heatmap for 3D visualization.
        """
        return [
            [round((np.sin((row + 1) * (col + 1) / 4.0) + 1.0) / 2.0, 4) for col in range(10)]
            for row in range(10)
        ]
