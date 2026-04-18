import asyncio, sys
sys.path.insert(0, '.')
from app.integrations.openrouter import call_llm

async def main():
    try:
        result = await call_llm('Reply with only valid JSON object: {"ok": true}')
        print('SUCCESS:', result)
    except Exception as e:
        print('ERROR:', type(e).__name__, '|', str(e))

asyncio.run(main())
