# Technical Documentation: TRIBE v2 Creative Diagnostics

## Overview
This platform is a high-performance video analysis tool inspired by Meta's TRIBE v2 foundation model. It aims to provide "Neuro-QA" for CTV (Connected TV) content by simulating human brain responses to audio-visual stimuli.

## System Architecture

### 1. Core Engine (Python/AI)
- **Model**: TRIBE v2 (fMRI/MEG Predictive Foundation Model).
- **Multimodal Backends**: Llama 3.2 (Text), V-JEPA (Vision), Wav2Vec-BERT (Audio).
- **Input**: MP4/MOV Video files.
- **Output**: Voxel activity heatmaps (3D), Neural Engagement scores, Cognitive Demand metrics.

### 2. Dashboard Interface (Next.js/Three.js)
- **Visualization**: Real-time 3D brain heatmap rendering using React Three Fiber.
- **Timeline**: Integrated video player with synchronized neural activity graphs.
- **Interactive QA**: Automated "Glitches" detection for sensory overload or disconnects.

## Data Flow
1. **Upload**: User uploads CTV creative.
2. **Preprocessing**: FFmpeg extracts frames at 1Hz (TRIBE requirement) and audio envelopes.
3. **Inference**: TRIBE v2 predicts voxel activity for each second of video.
4. **Analysis**: LLM (Gemini/Llama) interprets neural peaks/valleys into actionable creative advice.
5. **Report**: PDF/Dashboard summary (Neurons Inc style but with 3D Brain data).

## Current Setup Status
- [x] Folder structure initialized.
- [ ] Backend environment (Conda + TRIBE weights).
- [ ] Frontend design system (Pending brand assets).
- [ ] Integration API.
