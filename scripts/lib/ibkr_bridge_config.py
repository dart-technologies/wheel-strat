import os

DEFAULT_REMOTE_DOCKER_URL = "https://129-80-32-230.sslip.io"


def read_env(*names, default=None):
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return default


def normalize_profile(value):
    if not value:
        return None
    normalized = value.strip().lower().replace("-", "_")
    if normalized in ("local_mac", "local_docker", "remote_docker"):
        return normalized
    if normalized in ("mac", "native", "native_mac"):
        return "local_mac"
    if normalized in ("docker", "dock"):
        return "local_docker"
    if normalized in ("remote", "ngrok"):
        return "remote_docker"
    return None


def get_bridge_profile(env=os.environ):
    return normalize_profile(
        env.get("EXPO_PUBLIC_IBKR_BRIDGE_PROFILE") or env.get("IBKR_BRIDGE_PROFILE")
    ) or "remote_docker"


def normalize_explicit_bridge_url(explicit, env):
    if not explicit:
        return None
    trimmed = explicit.strip()
    if trimmed.startswith("http://") or trimmed.startswith("https://"):
        return trimmed
    profile = normalize_profile(trimmed)
    if profile:
        suffix = profile.upper()
        profile_url = env.get(f"EXPO_PUBLIC_IBKR_BRIDGE_URL_{suffix}") or env.get(f"IBKR_BRIDGE_URL_{suffix}")
        if profile_url:
            return profile_url
    if ":" in trimmed and "://" not in trimmed:
        return f"http://{trimmed}"
    return None


def get_default_bridge_url(env=os.environ):
    return (
        env.get("EXPO_PUBLIC_IBKR_BRIDGE_DEFAULT_URL")
        or env.get("IBKR_BRIDGE_DEFAULT_URL")
        or DEFAULT_REMOTE_DOCKER_URL
    )


def get_bridge_url(env=os.environ, explicit_url=None):
    explicit = explicit_url or env.get("EXPO_PUBLIC_IBKR_BRIDGE_URL") or env.get("IBKR_BRIDGE_URL")
    normalized = normalize_explicit_bridge_url(explicit, env)
    if normalized:
        return normalized

    profile = get_bridge_profile(env)
    suffix = profile.upper()
    profile_url = env.get(f"EXPO_PUBLIC_IBKR_BRIDGE_URL_{suffix}") or env.get(f"IBKR_BRIDGE_URL_{suffix}")
    if profile_url:
        return profile_url

    prod_url = env.get("EXPO_PUBLIC_IBKR_BRIDGE_URL_PROD") or env.get("IBKR_BRIDGE_URL_PROD")
    use_prod_services = env.get("EXPO_PUBLIC_USE_PROD_SERVICES") == "true"
    return (prod_url if use_prod_services else None) or prod_url or get_default_bridge_url(env)


def get_bridge_api_key(env=os.environ, explicit_key=None):
    return (
        explicit_key
        or env.get("IBKR_BRIDGE_API_KEY")
        or env.get("BRIDGE_API_KEY")
        or env.get("EXPO_PUBLIC_IBKR_BRIDGE_API_KEY")
        or ""
    )
