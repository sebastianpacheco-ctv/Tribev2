import cv2
import os
from typing import List
import numpy as np

class VideoProcessor:
    def __init__(self, output_dir: str = "tmp/frames"):
        self.output_dir = output_dir
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir, exist_ok=True)

    def extract_frames(self, video_path: str, fps: int = 1) -> List[str]:
        """
        Extracts frames from a video file at a specific frame rate.
        Returns a list of paths to the extracted frames.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Unable to open video file: {video_path}")

        video_fps = cap.get(cv2.CAP_PROP_FPS)
        sample_rate = max(1, fps)
        hop = max(1, round(video_fps / sample_rate)) if video_fps and video_fps > 0 else 1
        
        frame_paths = []
        count = 0
        
        while True:
            success, image = cap.read()
            if not success:
                break

            if count % hop == 0:
                frame_name = f"frame_{count:06d}.jpg"
                path = os.path.join(self.output_dir, frame_name)
                cv2.imwrite(path, image)
                frame_paths.append(path)
            count += 1
            
        cap.release()
        return frame_paths

    def get_frame_grid_analysis(self, frame_paths: List[str]) -> np.ndarray:
        """
        Converts extracted frames into a normalized RGB tensor ready for inference.
        """
        processed_frames = []

        for frame_path in sorted(frame_paths):
            frame = cv2.imread(frame_path)
            if frame is None:
                continue

            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame = cv2.resize(frame, (224, 224), interpolation=cv2.INTER_AREA)
            processed_frames.append(frame.astype(np.float32) / 255.0)

        if not processed_frames:
            raise ValueError("No readable frames were available for analysis.")

        return np.stack(processed_frames, axis=0)
