"""
Spectra AI — Local Whisper transcription using faster-whisper.
Returns full text + timestamped segments for precise fraud detection.

Input:  audio file path as first argument
Output: JSON { "text": "...", "segments": [{"start":4.2,"end":8.5,"text":"...","ts":"04:23"},...], "language": "ru", "duration": 120.0 }
"""
import sys
import json
import os


def fmt_ts(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def transcribe(audio_path: str) -> dict:
    from faster_whisper import WhisperModel

    model = WhisperModel("base", device="cpu", compute_type="int8")

    segments_gen, info = model.transcribe(
        audio_path,
        language="ru",
        beam_size=3,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    segments_list = []
    all_text = []

    for seg in segments_gen:
        text = seg.text.strip()
        if not text:
            continue
        segments_list.append({
            "start": round(seg.start, 1),
            "end":   round(seg.end,   1),
            "text":  text,
            "ts":    fmt_ts(seg.start),   # human-readable [MM:SS]
        })
        all_text.append(text)

    return {
        "text":     " ".join(all_text),
        "segments": segments_list,
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
