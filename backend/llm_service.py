import os
import json
import requests
from typing import Dict, Any, Optional, List
from datetime import datetime


class LLMService:
    """Service for interpreting natural language queries using Hugging Face Inference API."""
    
    def __init__(self):
        self.api_token = os.getenv("HUGGINGFACE_API_TOKEN")
        self.api_url = "https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium"
        self.fallback_model = "https://api-inference.huggingface.co/models/gpt2"
        
        # Available building attributes for filtering
        self.available_attributes = {
            "height_m": "Building height in meters",
            "floors": "Number of floors",
            "building_type": "Building classification (single_story, low_rise, mid_rise, high_rise)",
            "zoning": "Zoning code (e.g., RC-G, C-COR)",
            "land_use": "Land use type (residential, commercial, mixed_use)",
            "assessed_value": "Property assessed value"
        }
        
        # Available operators
        self.available_operators = {
            ">": "greater than",
            "<": "less than", 
            ">=": "greater than or equal to",
            "<=": "less than or equal to",
            "==": "equal to",
            "!=": "not equal to",
            "in": "in list of values",
            "contains": "contains text"
        }
    
    def _create_prompt(self, user_query: str) -> str:
        """Create a structured prompt for the LLM to interpret building queries."""
        
        prompt = f"""You are a building data filter interpreter. Convert this natural language query into a structured JSON filter.

AVAILABLE BUILDING ATTRIBUTES:
{json.dumps(self.available_attributes, indent=2)}

AVAILABLE OPERATORS:
{json.dumps(self.available_operators, indent=2)}

USER QUERY: "{user_query}"

Convert this to a JSON object with these fields:
- "attribute": the building attribute to filter on
- "operator": the comparison operator to use  
- "value": the value to compare against
- "description": human-readable description of what this filter does

If the query mentions multiple conditions, return an array of filter objects.

EXAMPLES:
Query: "show buildings over 100 feet tall"
Response: {{"attribute": "height_m", "operator": ">", "value": 30.48, "description": "Buildings taller than 30.48 meters (100 feet)"}}

Query: "highlight commercial buildings"
Response: {{"attribute": "land_use", "operator": "==", "value": "commercial", "description": "Commercial buildings only"}}

Query: "buildings with 5 or more floors"
Response: {{"attribute": "floors", "operator": ">=", "value": 5, "description": "Buildings with 5 or more floors"}}

Now convert this query: "{user_query}"

Return only the JSON, no other text:"""

        return prompt
    
    def _call_huggingface_api(self, prompt: str) -> Optional[str]:
        """Call Hugging Face Inference API with the prompt."""
        
        if not self.api_token:
            print("Warning: No Hugging Face API token found. Using fallback response.")
            return None
        
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_length": 200,
                "temperature": 0.1,
                "do_sample": False
            }
        }
        
        try:
            response = requests.post(
                self.api_url,
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            # Parse the response
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                return result[0].get("generated_text", "")
            return result.get("generated_text", "")
            
        except requests.exceptions.RequestException as e:
            print(f"Error calling Hugging Face API: {e}")
            return None
    
    def _fallback_interpretation(self, user_query: str) -> Dict[str, Any]:
        """Fallback interpretation when LLM is not available."""
        
        query_lower = user_query.lower()
        
        # Simple keyword-based interpretation
        if "height" in query_lower or "tall" in query_lower or "feet" in query_lower:
            # Extract height value
            import re
            height_match = re.search(r'(\d+)\s*(?:feet?|ft)', query_lower)
            if height_match:
                height_ft = int(height_match.group(1))
                height_m = height_ft * 0.3048
                return {
                    "attribute": "height_m",
                    "operator": ">",
                    "value": height_m,
                    "description": f"Buildings taller than {height_ft} feet ({height_m:.1f}m)"
                }
            else:
                return {
                    "attribute": "height_m",
                    "operator": ">",
                    "value": 30.0,
                    "description": "Tall buildings (over 30 meters)"
                }
        
        elif "floor" in query_lower or "story" in query_lower:
            # Extract floor count
            import re
            floor_match = re.search(r'(\d+)\s*(?:floor|story)', query_lower)
            if floor_match:
                floors = int(floor_match.group(1))
                return {
                    "attribute": "floors",
                    "operator": ">=",
                    "value": floors,
                    "description": f"Buildings with {floors} or more floors"
                }
            else:
                return {
                    "attribute": "floors",
                    "operator": ">=",
                    "value": 5,
                    "description": "Multi-story buildings (5+ floors)"
                }
        
        elif "commercial" in query_lower or "business" in query_lower:
            return {
                "attribute": "land_use",
                "operator": "==",
                "value": "commercial",
                "description": "Commercial buildings only"
            }
        
        elif "residential" in query_lower or "home" in query_lower:
            return {
                "attribute": "land_use",
                "operator": "==",
                "value": "residential",
                "description": "Residential buildings only"
            }
        
        elif "low rise" in query_lower or "low-rise" in query_lower:
            return {
                "attribute": "building_type",
                "operator": "==",
                "value": "low_rise",
                "description": "Low-rise buildings"
            }
        
        elif "high rise" in query_lower or "high-rise" in query_lower or "skyscraper" in query_lower:
            return {
                "attribute": "building_type",
                "operator": "==",
                "value": "high_rise",
                "description": "High-rise buildings"
            }
        
        # Default fallback
        return {
            "attribute": "height_m",
            "operator": ">",
            "value": 10.0,
            "description": "Buildings taller than 10 meters (default interpretation)"
        }
    
    def _parse_llm_response(self, response: str) -> Optional[Dict[str, Any]]:
        """Parse the LLM response and extract the JSON filter."""
        
        if not response:
            return None
        
        try:
            # Try to find JSON in the response
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                parsed = json.loads(json_str)
                
                # Validate the parsed response
                required_fields = ["attribute", "operator", "value"]
                if all(field in parsed for field in required_fields):
                    return parsed
                
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Error parsing LLM response: {e}")
        
        return None
    
    def interpret_query(self, user_query: str) -> Dict[str, Any]:
        """Interpret a natural language query and return structured filter(s)."""
        
        if not user_query or not user_query.strip():
            return {
                "success": False,
                "error": "Query cannot be empty"
            }
        
        # Create the prompt
        prompt = self._create_prompt(user_query.strip())
        
        # Try LLM interpretation first
        llm_response = self._call_huggingface_api(prompt)
        parsed_filter = self._parse_llm_response(llm_response)
        
        if parsed_filter:
            return {
                "success": True,
                "query": user_query,
                "interpreted_filter": parsed_filter,
                "method": "llm",
                "timestamp": datetime.now().isoformat()
            }
        
        # Fallback to keyword-based interpretation
        fallback_filter = self._fallback_interpretation(user_query)
        
        return {
            "success": True,
            "query": user_query,
            "interpreted_filter": fallback_filter,
            "method": "fallback",
            "timestamp": datetime.now().isoformat()
        }
    
    def get_available_filters(self) -> Dict[str, Any]:
        """Get information about available filter attributes and operators."""
        
        return {
            "available_attributes": self.available_attributes,
            "available_operators": self.available_operators,
            "examples": [
                "show buildings over 100 feet tall",
                "highlight commercial buildings", 
                "buildings with 5 or more floors",
                "low-rise residential buildings",
                "tall buildings in downtown"
            ]
        }


# Global instance
llm_service = LLMService()
