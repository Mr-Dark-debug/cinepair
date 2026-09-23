"""Validation for user-selected playback sources.

Only YouTube's player API and a browser-native direct video element are
controlled by CinePair. Other providers are launch shortcuts; their own
capture and embedding policies still apply.
"""

import math
import re
from urllib.parse import urlparse


YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
VIMEO_ID = re.compile(r"^[0-9]{1,16}$")
DAILYMOTION_ID = re.compile(r"^[A-Za-z0-9]{1,32}$")
LAUNCH_PROVIDERS = {"vimeo", "dailymotion", "twitch", "netflix", "prime", "hotstar", "disney", "hulu", "max"}


def validate_source(source: object) -> dict:
    if not isinstance(source, dict):
        raise ValueError("Invalid watch source.")
    provider = source.get("provider")
    if provider == "youtube":
        video_id = source.get("video_id")
        if not isinstance(video_id, str) or not YOUTUBE_ID.fullmatch(video_id):
            raise ValueError("Enter a valid YouTube video ID or link.")
        result = {"provider": provider, "video_id": video_id}
    elif provider == "direct":
        url = source.get("url")
        if not isinstance(url, str) or len(url) > 2048:
            raise ValueError("Enter a direct video URL.")
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
            raise ValueError("Direct video URLs must use HTTPS.")
        if not parsed.path.lower().endswith((".mp4", ".webm", ".ogg")):
            raise ValueError("Use a direct MP4, WebM, or Ogg video URL.")
        result = {"provider": provider, "url": url}
    elif provider in LAUNCH_PROVIDERS:
        result = {"provider": provider}
        video_id = source.get("video_id")
        if video_id is not None:
            pattern = VIMEO_ID if provider == "vimeo" else DAILYMOTION_ID if provider == "dailymotion" else None
            if pattern is None or not isinstance(video_id, str) or not pattern.fullmatch(video_id):
                raise ValueError("Invalid provider video ID.")
            result["video_id"] = video_id
    else:
        raise ValueError("Unsupported watch source.")
    title = source.get("title")
    if isinstance(title, str) and title.strip():
        result["title"] = title.strip()[:160]
    return result


def validate_sync(position: object, rate: object) -> tuple[float, float]:
    try:
        position_value = float(position)
        rate_value = float(rate)
    except (TypeError, ValueError):
        raise ValueError("Invalid playback position or rate.") from None
    if not math.isfinite(position_value) or position_value < 0 or position_value > 86400:
        raise ValueError("Invalid playback position.")
    if not math.isfinite(rate_value) or not 0.25 <= rate_value <= 2:
        raise ValueError("Invalid playback rate.")
    return position_value, rate_value
