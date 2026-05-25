"""
Advanced sentence analysis utilities for humanization.
"""

import re
from typing import List, Dict, Any, Tuple

class SentenceAnalyzer:
    """Analyze sentence structure for rhythm and naturalness."""
    
    @staticmethod
    def analyze_sentence_lengths(text: str) -> Dict[str, Any]:
        """Analyze sentence length distribution and rhythm."""
        # Split by sentence markers but keep track of punctuation for pacing
        sentences = re.split(r'([.!?]+)', text.strip())
        sentence_texts = []
        for i in range(0, len(sentences)-1, 2):
            sentence_texts.append(sentences[i].strip() + sentences[i+1])
        
        if not sentence_texts:
            # Fallback for plain text without punctuation
            sentence_texts = [text.strip()] if text.strip() else []
            
        if not sentence_texts:
            return {"count": 0, "avg_length": 0, "variance": 0, "lengths": [], "rhythm_score": 0}
        
        lengths = [len(s.split()) for s in sentence_texts]
        avg_length = sum(lengths) / len(lengths)
        variance = sum((l - avg_length) ** 2 for l in lengths) / len(lengths) if len(lengths) > 1 else 0
        
        # Calculate rhythm score (high variance and mixed lengths are good)
        # Ideal rhythm: short, medium, long, short (variance > 10 is usually good for business)
        rhythm_score = min(10.0, (variance / 5.0) * 2)
        
        return {
            "count": len(sentence_texts),
            "avg_length": avg_length,
            "variance": variance,
            "min_length": min(lengths),
            "max_length": max(lengths),
            "lengths": lengths,
            "rhythm_score": rhythm_score
        }
    
    @staticmethod
    def detect_repetitive_structure(text: str) -> List[Dict[str, Any]]:
        """Detect repetitive sentence structures and symmetry (signs of AI)."""
        sentences = re.split(r'[.!?]+', text.strip())
        sentences = [s.strip() for s in sentences if s.strip()]
        
        patterns = []
        if not sentences:
            return patterns
            
        # 1. Repeated starting words/phrases
        starting_phrases = [" ".join(s.split()[:2]).lower() if len(s.split()) >= 2 else s.split()[0].lower() if s.split() else "" for s in sentences]
        phrase_counts = {}
        for phrase in starting_phrases:
            if phrase:
                phrase_counts[phrase] = phrase_counts.get(phrase, 0) + 1
        
        for phrase, count in phrase_counts.items():
            if count > 1:
                patterns.append({
                    "type": "repeated_opener",
                    "phrase": phrase,
                    "count": count,
                    "severity": min(1.0, (count - 1) / len(sentences))
                })
        
        # 2. Structural Symmetry (e.g., "We X, you Y. We A, you B.")
        subject_verb_pattern = re.compile(r'^(we|i|our|your|the)\s+\w+', re.IGNORECASE)
        matches = [bool(subject_verb_pattern.match(s)) for s in sentences]
        symmetry_count = sum(1 for i in range(len(matches)-1) if matches[i] and matches[i+1])
        
        if symmetry_count > len(sentences) * 0.4:
            patterns.append({
                "type": "structural_symmetry",
                "count": symmetry_count,
                "severity": min(1.0, symmetry_count / len(sentences))
            })
            
        # 3. List-like cadence (similar lengths in sequence)
        lengths = [len(s.split()) for s in sentences]
        monotony_count = 0
        for i in range(len(lengths)-1):
            if abs(lengths[i] - lengths[i+1]) <= 2:
                monotony_count += 1
        
        if monotony_count > len(sentences) * 0.6:
            patterns.append({
                "type": "cadence_monotony",
                "severity": min(1.0, monotony_count / len(sentences))
            })
        
        return patterns
    
    @staticmethod
    def detect_ai_markers(text: str) -> List[Dict[str, Any]]:
        """Detect advanced AI-generated markers and clichés."""
        markers = []
        
        # AI-typical phrases (Extended list)
        ai_phrases = [
            (r'\b(optimize|leverage|maximize|enhance|streamline|harness)\b.*(efficiency|productivity|operations|growth)', "corporate_cliché"),
            (r'\b(innovative|cutting-edge|comprehensive|seamless|robust)\s+solution\b', "solution_cliché"),
            (r'\b(in the current|in today\'s)\s+(landscape|world|market)\b', "landscape_filler"),
            (r'\b(it is important to|please note that|worth noting)\b', "passive_filler"),
            (r'\b(furthermore|moreover|additionally|consequently)\b', "formal_connector"),
            (r'\b(unlock|transform|accelerate|drive)\s+your\b', "marketing_verb"),
            (r'\b(hope this email finds you well|i trust you are having a productive week)\b', "standard_opener"),
            (r'\b(let\'s connect|schedule a call|hop on a quick call)\b', "standard_cta")
        ]
        
        for pattern, type_name in ai_phrases:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                markers.append({
                    "type": type_name,
                    "count": len(matches),
                    "severity": 0.4 * len(matches)
                })
        
        # Imperfect punctuation (human-like lack of markers can be good, but AI is usually too perfect)
        # Here we look for "too perfect" structure
        if re.search(r'^[A-Z].*[.!?]$', text.strip()) and not re.search(r'[^.!?]\s\w', text):
            # Very structured text might be AI
            pass 
            
        return markers
    
    @staticmethod
    def analyze_pacing(text: str) -> Dict[str, Any]:
        """Analyze natural pacing (transitions and sentence flow)."""
        sentences = re.split(r'[.!?]+', text.strip())
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if len(sentences) < 2:
            return {"pacing_score": 5.0, "transitions": []}
            
        # Check for varied sentence starts
        starts = [s.split()[0].lower() if s.split() else "" for s in sentences]
        unique_starts = len(set(starts))
        start_variety = unique_starts / len(sentences)
        
        # Check for natural transitions (human-like)
        natural_transitions = ['so', 'actually', 'btw', 'on that note', 'specifically', 'to be honest', 'plus', 'anyway']
        formal_transitions = ['furthermore', 'moreover', 'additionally', 'consequently', 'therefore']
        
        natural_count = sum(1 for s in starts if s in natural_transitions)
        formal_count = sum(1 for s in starts if s in formal_transitions)
        
        # Business humanization should have a balance
        pacing_score = (start_variety * 5) + (natural_count * 2) - (formal_count * 1)
        
        return {
            "pacing_score": min(10.0, max(0.0, pacing_score)),
            "natural_transition_count": natural_count,
            "formal_transition_count": formal_count,
            "variety_ratio": start_variety
        }

    @staticmethod
    def calculate_humanness_score(text: str) -> Dict[str, Any]:
        """Calculate multi-dimensional humanness score."""
        length_analysis = SentenceAnalyzer.analyze_sentence_lengths(text)
        patterns = SentenceAnalyzer.detect_repetitive_structure(text)
        markers = SentenceAnalyzer.detect_ai_markers(text)
        pacing = SentenceAnalyzer.analyze_pacing(text)
        
        # Calculate individual components
        rhythm_score = length_analysis['rhythm_score']
        pattern_penalty = sum(p['severity'] for p in patterns) * 2.0
        marker_penalty = sum(m['severity'] for m in markers)
        pacing_score = pacing['pacing_score']
        
        # Base score
        base_score = 6.0
        final_score = base_score + (rhythm_score * 0.2) + (pacing_score * 0.3) - pattern_penalty - marker_penalty
        
        # Variance bonus
        if length_analysis['variance'] > 15:
            final_score += 1.0
            
        return {
            "overall_score": min(10.0, max(0.0, final_score)),
            "rhythm": rhythm_score,
            "pacing": pacing_score,
            "pattern_penalty": pattern_penalty,
            "marker_penalty": marker_penalty,
            "metrics": {
                "length_variance": length_analysis['variance'],
                "sentence_count": length_analysis['count'],
                "ai_markers_found": len(markers),
                "repetitive_patterns": len(patterns)
            }
        }