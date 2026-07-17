from faster_whisper import WhisperModel
import os

model = WhisperModel("large-v3", device="cuda", compute_type="float16")
# no GPU? use: device="cpu", compute_type="int8"

video_folder = r"C:\Users\ng528\Documents\Zoom\2026-07-11 19.09.26 Matt Ng's Zoom Meeting"
output_folder = r"C:\Users\ng528\Documents\Zoom\transcripts"
os.makedirs(output_folder, exist_ok=True)

for filename in os.listdir(video_folder):
    if filename.lower().endswith((".mp4", ".m4a")):
        path = os.path.join(video_folder, filename)
        segments, info = model.transcribe(path, beam_size=5)
        
        out_path = os.path.join(output_folder, filename.rsplit(".", 1)[0] + ".txt")
        with open(out_path, "w", encoding="utf-8") as f:
            for seg in segments:
                f.write(f"[{seg.start:.2f}s -> {seg.end:.2f}s] {seg.text.strip()}\n")
        
        print(f"Done: {filename}")