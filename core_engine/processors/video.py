import cv2
import os
from typing import List, Tuple
import numpy as np

class VideoProcessor:
    def __init__(self, output_dir: str = "tmp/frames"):
        self.output_dir = output_dir
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def extract_frames(self, video_path: str, fps: int = 1) -> List[str]:
        """
        Extracts frames from a video file at a specific frame rate.
        Returns a list of paths to the extracted frames.
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        cap = cv2.VideoCapture(video_path)
        video_fps = cap.get(cv2.CAP_PROP_FPS)
        hop = round(video_fps / fps)
        
        frame_paths = []
        count = 0
        success = True
        
        while success:
            success, image = cap.read()
            if success and count % hop == 0:
                frame_name = f"frame_{count}.jpg"
                path = os.path.join(self.output_dir, frame_name)
                cv2.imwrite(path, image)
                frame_paths.append(path)
            count += 1
            
        cap.release()
        return frame_paths

    def get_frame_grid_analysis(self, frame_paths: List[str]) -> np.ndarray:
        """
        Placeholder for converting frames into a visual stimuli grid for TRIBE v2.
        """
        # In a real TRIBE implementation, we would stack these frames
        # and normalize them for the neural network input.
        return np.zeros((len(frame_paths), 224, 224, 3))
