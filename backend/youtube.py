import yt_dlp
import uuid
from pathlib import Path
import re

def is_youtube_url(url):
    # Patrones más precisos para URLs de YouTube
    patterns = [
        r'^https?://(?:www\.)?youtube\.com/watch\?v=[\w-]+',
        r'^https?://(?:www\.)?youtube\.com/v/[\w-]+',
        r'^https?://youtu\.be/[\w-]+',
    ]
    return any(re.match(pattern, url) for pattern in patterns)

def download_youtube_audio(url, media_dir):
    try:
        filename = f"{uuid.uuid4().hex}.mp3"
        output_path = str(Path(media_dir) / filename)
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_path.replace('.mp3', ''),  # yt-dlp agregará la extensión
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'ffmpeg_location': 'C:\\ffmpeg\\bin\\ffmpeg.exe',  # Ruta correcta a ffmpeg
            'quiet': True,
            'no_warnings': True
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"Downloading from {url}...")
            info = ydl.extract_info(url, download=True)
            print("Download complete!")
            
            # Verificar que el archivo existe
            expected_file = Path(output_path)
            if not expected_file.exists():
                print(f"Error: File not found at {output_path}")
                return {'error': 'File not found after download'}
            
            print(f"File saved at {output_path}")
            return {
                'url': f'/media/{filename}',
                'title': info.get('title', 'Unknown'),
                'artist': info.get('uploader', 'YouTube')
            }
            
    except Exception as e:
        print(f"Error downloading: {str(e)}")
        return {'error': f"Error downloading: {str(e)}"}