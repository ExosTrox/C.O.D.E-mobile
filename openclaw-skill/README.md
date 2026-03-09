# CODE Mobile — OpenClaw Skill

An OpenClaw skill that generates access codes for CODE Mobile.

## Usage

Users on WhatsApp (or any OpenClaw channel) can say:

- "give me a terminal"
- "terminal code"
- "code mobile"

OpenClaw will generate a one-time access code and reply with it.

## Installation

### Option 1: Install as a skill
```bash
openclaw skill install ./openclaw-skill
```

### Option 2: Copy to skills directory
```bash
cp -r openclaw-skill ~/.openclaw/skills/code-mobile
```

## Configuration

The skill expects the CODE Mobile daemon to be running on the same server at `http://localhost:3000`.

If running on a different port or host, set `CODE_MOBILE_URL` in the skill config:

```json
{
  "CODE_MOBILE_URL": "http://localhost:3000"
}
```
