"""
Local Whisper transcription using faster-whisper.
Called from Node.js via child_process.spawnSync.

Input:  audio file path as first argument
Output: JSON to stdout { "text": "...", "language": "ru", "duration": 12.3 }
"""
import sys
import json
import os

def transcribe(audio_path: str) -> dict:
    from faster_whisper import WhisperModel

    # Use 'base' model — fast, good for Russian, ~150MB download on first run
    model = WhisperModel("base", device="cpu", compute_type="int8")

    segments, info = model.transcribe(
        audio_path,
        language="ru",
        beam_size=3,
        vad_filter=True,          # skip silence
        vad_parameters={"min_silence_duration_ms": 500},
    )

    text = " ".join(seg.text.strip() for seg in segments)
    return {
        "text": text,
        "language": info.language,
        "duration": round(info.duration, 1),
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No audio path provided"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"File not found: {audio_path}"}))
        sys.exit(1)

    try:
        result = transcribe(audio_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
