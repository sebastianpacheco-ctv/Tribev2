import google.generativeai as genai
import os
from typing import Dict, Any
from dotenv import load_dotenv

class InsightGenerator:
    def __init__(self, api_key: str = None):
        load_dotenv()
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel(
                "gemini-1.5-flash",
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": 0,
                    "top_p": 0.1,
                },
            )
        else:
            self.model = None

    async def generate_explanation(self, neural_data: Dict[str, Any]) -> str:
        """
        Interprets raw logic into the 'CTV Quality Template' format.
        Returns a raw JSON string to be parsed by the router.
        """
        if not self.model:
            return '{"error": "Gemini API key not configured."}'

        prompt = f"""
        You are a deterministic QA scoring agent evaluating a CTV video creative.
        You must evaluate based on three primary strategy categories: Eye-Catching, Storytelling, or Clever Concept.
        
        Neural/Simulated Data input:
        {neural_data}
        
        Given the above activation, output the EXACT JSON schema below describing your professional QA verdict.
        Return valid JSON only.
        DO NOT include markdown formatting, json backticks, or prose outside the JSON object.
        
        Required JSON Schema:
        {{
          "hybrid_flags": {{
             "pacing_warnings": ["List any text-based warnings here based on sensory load anomalies"],
             "transition_warnings": ["List visual transition issues"],
             "brand_voice_score": 0.85
          }},
          "final_decision": {{
             "strategy_category": "Storytelling",
             "approved": false,
             "revisions_required": true
          }}
        }}
        """
        
        try:
            response = self.model.generate_content(prompt)
            return response.text or '{"error": "Empty response from Gemini."}'
        except Exception:
            return '{{"error": "Error generating JSON."}}'
