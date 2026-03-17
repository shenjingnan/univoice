import os
import requests

url = "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions"

# 替换为实际的音频文件路径
audio_file_path = "path/to/your/audio.mp3"
files = {"file": ("example-file", open(audio_file_path, "rb"))}
payload = {
    "model": "glm-asr-2512",
}
api_key = os.environ.get("GLM_API_KEY", "your_api_key")
headers = {"Authorization": f"Bearer {api_key}"}

response = requests.post(url, data=payload, files=files, headers=headers)

print(response.text)
