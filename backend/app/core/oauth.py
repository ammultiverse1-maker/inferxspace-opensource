"""
OAuth helpers — Google & GitHub
Reads client credentials from environment via settings.
Users must register their own OAuth app and set:
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
  GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
"""

import httpx
from app.core.config import settings


async def get_google_user_info(id_token: str) -> dict:
    """
    Verify a Google ID token and return the user's profile.
    Uses Google's tokeninfo endpoint (no extra library needed).
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
            timeout=10,
        )
    if resp.status_code != 200:
        raise ValueError("Invalid Google ID token")

    data = resp.json()

    # Verify this token was issued for YOUR app
    if data.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise ValueError("Google token audience mismatch")

    return {
        "sub": data.get("sub"),
        "email": data.get("email"),
        "name": data.get("name", ""),
        "picture": data.get("picture", ""),
        "email_verified": data.get("email_verified") == "true",
    }


async def get_github_user_info(code: str) -> dict:
    """
    Exchange a GitHub OAuth code for an access token, then fetch the user profile.
    """
    async with httpx.AsyncClient() as client:
        # Exchange code for token
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
            timeout=10,
        )

        if token_resp.status_code != 200:
            raise ValueError("Failed to exchange GitHub code for token")

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise ValueError("No access token in GitHub response")

        # Fetch user profile
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
            timeout=10,
        )

        if user_resp.status_code != 200:
            raise ValueError("Failed to fetch GitHub user info")

        user_data = user_resp.json()

        # GitHub may not expose email publicly — fetch separately
        email = user_data.get("email")
        if not email:
            email_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
                timeout=10,
            )
            if email_resp.status_code == 200:
                emails = email_resp.json()
                primary = next((e for e in emails if e.get("primary")), None)
                email = primary["email"] if primary else (emails[0]["email"] if emails else None)

    return {
        "id": str(user_data.get("id")),
        "email": email,
        "name": user_data.get("name") or user_data.get("login", ""),
        "avatar_url": user_data.get("avatar_url", ""),
        "login": user_data.get("login", ""),
    }
