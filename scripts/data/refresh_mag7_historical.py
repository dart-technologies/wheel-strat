#!/usr/bin/env python3
import argparse
import os
import subprocess
import sys
from pathlib import Path

MAG7 = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META']

SCRIPT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(SCRIPT_ROOT / 'lib'))

from ibkr_bridge_config import get_bridge_url, get_bridge_api_key, read_env  # noqa: E402


def load_env():
    try:
        from dotenv import load_dotenv  # type: ignore
        env_file = os.getenv('IBKR_BRIDGE_ENV_FILE') or os.getenv('BRIDGE_ENV_FILE')
        if env_file:
            load_dotenv(env_file)
        else:
            load_dotenv()
            load_dotenv('.env.local', override=True)
    except Exception:
        return


def main():
    load_env()

    parser = argparse.ArgumentParser(description='Refresh Mag7 historical cache from IBKR bridge.')
    parser.add_argument('--bridge-url', default=read_env('IBKR_BRIDGE_URL', 'EXPO_PUBLIC_IBKR_BRIDGE_URL'))
    parser.add_argument('--profile', default=read_env('IBKR_BRIDGE_PROFILE', 'EXPO_PUBLIC_IBKR_BRIDGE_PROFILE'))
    parser.add_argument('--api-key', default=read_env('IBKR_BRIDGE_API_KEY', 'BRIDGE_API_KEY', 'EXPO_PUBLIC_IBKR_BRIDGE_API_KEY'))
    parser.add_argument('--duration', default='5 Y')
    parser.add_argument('--bar-size', default='1 day')
    parser.add_argument('--timeout', type=float, default=60.0)
    parser.add_argument('--symbols', default=','.join(MAG7))
    args = parser.parse_args()

    env = dict(os.environ)
    if args.profile:
        env['EXPO_PUBLIC_IBKR_BRIDGE_PROFILE'] = args.profile
        env['IBKR_BRIDGE_PROFILE'] = args.profile

    bridge_url = get_bridge_url(env, explicit_url=args.bridge_url)
    if not bridge_url:
        print('Bridge URL not resolved. Set IBKR_BRIDGE_URL or profile env.', file=sys.stderr)
        return 1

    api_key = get_bridge_api_key(env, explicit_key=args.api_key)
    if not api_key:
        print('Missing IBKR bridge API key. Set IBKR_BRIDGE_API_KEY.', file=sys.stderr)
        return 1

    repo_root = Path(__file__).resolve().parents[2]
    script_path = repo_root / 'scripts' / 'data' / 'fetch_data.js'

    timeout_ms = int(args.timeout * 1000)
    cmd = [
        'node',
        str(script_path),
        '--bridgeUrl', bridge_url,
        '--apiKey', api_key,
        '--duration', args.duration,
        '--barSize', args.bar_size,
        '--timeoutMs', str(timeout_ms),
        '--symbols', args.symbols
    ]

    result = subprocess.run(cmd, cwd=repo_root, env=env)
    return result.returncode


if __name__ == '__main__':
    raise SystemExit(main())
