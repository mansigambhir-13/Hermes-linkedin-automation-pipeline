"""Postiz public-API client.

Docs: https://docs.postiz.com/public-api

Auth: `Authorization: <api-key>` header — raw key, NO Bearer prefix.
Base URL: https://api.postiz.com/public/v1 (cloud) or self-hosted equivalent.

Rate limit: 100 req/hour for /posts on cloud, 90 on self-hosted (instance-wide).
Tip from docs: "schedule multiple posts in a single request to maximize
throughput" — so this client supports batching all of a day's cards into one
/posts call.

Image handling: images MUST be pre-uploaded via /upload (base64-inline errors
with 413 Payload Too Large). Workflow: upload each PNG, collect ids, then
POST /posts referencing those ids.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

POSTIZ_URL = os.environ.get("POSTIZ_API_URL", "https://api.postiz.com/public/v1").rstrip("/")
POSTIZ_KEY = os.environ.get("POSTIZ_API_KEY")


class PostizError(RuntimeError):
    pass


def _headers(extra: dict | None = None) -> dict:
    if not POSTIZ_KEY:
        raise PostizError("POSTIZ_API_KEY not set (see v6/README.md).")
    h = {"Authorization": POSTIZ_KEY}
    if extra:
        h.update(extra)
    return h


# ---------------------------------------------------------------------------
# Integrations
# ---------------------------------------------------------------------------

@dataclass
class Integration:
    id: str
    name: str
    identifier: str        # 'linkedin-page' | 'instagram-standalone' | 'x' | 'linkedin'
    disabled: bool = False

    @property
    def platform(self) -> str:
        """Normalised platform for our routing logic."""
        i = (self.identifier or "").lower()
        if "linkedin" in i:
            return "linkedin"
        if "instagram" in i or i == "ig":
            return "instagram"
        if i in ("x", "twitter", "x-com"):
            return "x"
        return i or "unknown"


def list_integrations(timeout: float = 30.0) -> list[Integration]:
    """GET /integrations — returns enabled integrations."""
    r = httpx.get(f"{POSTIZ_URL}/integrations", headers=_headers(), timeout=timeout)
    if r.status_code >= 400:
        raise PostizError(f"/integrations {r.status_code}: {r.text[:300]}")
    out = []
    for it in r.json():
        out.append(Integration(
            id=it["id"],
            name=it.get("name") or "",
            identifier=it.get("identifier") or "",
            disabled=bool(it.get("disabled")),
        ))
    return out


def pick_integrations(
    integrations: list[Integration], platforms: list[str]
) -> dict[str, Integration]:
    """Map requested platforms ('linkedin', 'instagram', 'x') -> their Integration.

    Skips disabled accounts. If multiple integrations match a platform (rare —
    two LinkedIn pages, say), takes the first non-disabled one.
    """
    out: dict[str, Integration] = {}
    for p in platforms:
        for it in integrations:
            if it.disabled:
                continue
            if it.platform == p:
                out[p] = it
                break
    return out


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

@dataclass
class UploadedMedia:
    id: str
    path: str            # public URL on Postiz' CDN


def upload_media(image_path: Path, timeout: float = 60.0) -> UploadedMedia:
    """POST /upload multipart — returns {id, path}."""
    if not image_path.exists():
        raise PostizError(f"image not found: {image_path}")
    with open(image_path, "rb") as fh:
        files = {"file": (image_path.name, fh, "image/png")}
        r = httpx.post(
            f"{POSTIZ_URL}/upload",
            headers=_headers(),    # do NOT set Content-Type; httpx handles multipart
            files=files,
            timeout=timeout,
        )
    if r.status_code >= 400:
        raise PostizError(f"/upload {r.status_code}: {r.text[:300]}")
    data = r.json()
    return UploadedMedia(id=data["id"], path=data["path"])


# ---------------------------------------------------------------------------
# Schedule posts
# ---------------------------------------------------------------------------

@dataclass
class PostSpec:
    """One card → one post on one platform."""
    integration_id: str
    platform: str           # 'linkedin' | 'instagram' | 'x'
    caption: str
    media: UploadedMedia
    when_iso: str           # ISO 8601 with 'Z', e.g. '2026-05-29T04:00:00.000Z'

    def to_postiz_post(self) -> dict[str, Any]:
        # Platform-specific settings — Instagram REQUIRES post_type, LinkedIn
        # accepts a minimal object. Discovered the IG requirement empirically
        # via /posts 400 ("settings.post_type must be one of: post, story").
        settings: dict[str, Any] = {"__type": self.platform}
        if self.platform == "instagram":
            settings["post_type"] = "post"
        return {
            "integration": {"id": self.integration_id},
            "value": [{
                "content": self.caption,
                "image": [{"id": self.media.id, "path": self.media.path}],
            }],
            "settings": settings,
        }


def schedule_batch(
    posts: list[PostSpec],
    *,
    when_iso: str,
    dry_run: bool = False,
    timeout: float = 60.0,
) -> dict[str, Any]:
    """POST /posts with all cards in one request (per Postiz throughput tip).

    `when_iso` is the schedule time for the whole batch (all posts go up together);
    if you want staggered times, call this once per slot with a 1-element list.

    Returns Postiz' response, or the would-be payload when dry_run=True.
    """
    if not posts:
        return {"skipped": "no posts"}

    payload = {
        "type": "schedule",
        "date": when_iso,
        "shortLink": False,
        "tags": [],
        "posts": [p.to_postiz_post() for p in posts],
    }
    if dry_run:
        return {"dry_run": True, "payload": payload}

    r = httpx.post(
        f"{POSTIZ_URL}/posts",
        headers=_headers({"Content-Type": "application/json"}),
        json=payload,
        timeout=timeout,
    )
    if r.status_code >= 400:
        raise PostizError(f"/posts {r.status_code}: {r.text[:500]}")
    return r.json()


# ---------------------------------------------------------------------------
# Scheduling helpers
# ---------------------------------------------------------------------------

def next_slot_iso(hour_local: int = 10, days_ahead: int = 1) -> str:
    """Default scheduling rule: post N days from today at HH:00 local time.

    Returns ISO 8601 UTC with a 'Z' suffix (Postiz expects UTC).
    """
    from datetime import datetime, timedelta, timezone

    local = datetime.now().astimezone()
    target_local = (local + timedelta(days=days_ahead)).replace(
        hour=hour_local, minute=0, second=0, microsecond=0,
    )
    target_utc = target_local.astimezone(timezone.utc)
    return target_utc.strftime("%Y-%m-%dT%H:%M:%S.000Z")
