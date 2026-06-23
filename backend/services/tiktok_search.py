"""
TikTok video search via TikTokApi (Playwright-based headless browser).
Usage: python tiktok_search.py <keyword> <count>
Outputs one JSON per line (NDJSON) to stdout.
"""
import asyncio
import sys
import json
import io
from TikTokApi import TikTokApi

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

async def search(keyword: str, count: int):
    async with TikTokApi() as api:
        await api.create_sessions(
            num_sessions=1,
            sleep_after=3,
            headless=True,
        )

        found = 0
        # obj_type='item' searches for videos
        async for video in api.search.search_type(keyword, "item", count=count):
            try:
                info = video.as_dict
                vid_id   = info.get("id", "")
                author   = info.get("author", {})
                username = author.get("uniqueId", "") or author.get("id", "")
                desc     = info.get("desc", "")
                stats    = info.get("stats", {})
                vdata    = info.get("video", {})
                text_extra = info.get("textExtra") or []
                tags = [t["hashtagName"] for t in text_extra if t.get("hashtagName")]

                row = {
                    "id": vid_id,
                    "url": f"https://www.tiktok.com/@{username}/video/{vid_id}",
                    "title": desc,
                    "uploader": username,
                    "description": desc,
                    "platform": "tiktok",
                    "thumbnail": vdata.get("cover", "") or vdata.get("originCover", ""),
                    "viewCount": stats.get("playCount", 0),
                    "likeCount": stats.get("diggCount", 0),
                    "duration": vdata.get("duration", 0),
                    "tags": tags,
                }
                print(json.dumps(row, ensure_ascii=False), flush=True)
                found += 1
            except Exception as e:
                sys.stderr.write(f"[item error] {e}\n")

        if found == 0:
            sys.stderr.write("[tiktok_search] No videos found\n")

if __name__ == "__main__":
    keyword = sys.argv[1] if len(sys.argv) > 1 else "казино"
    count   = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    asyncio.run(search(keyword, count))
