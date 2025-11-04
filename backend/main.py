import os 
import asyncio

from g4f.client import AsyncClient

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn

class GptCreate(BaseModel):
    model: str = "Qwen/Qwen3-14B"
    prompt: str 
    
class GptResult(BaseModel):
    status: int
    message: str 

client = AsyncClient()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post('/create/chat', response_model=GptResult)
async def create_gpt(param: GptCreate):
    result = await client.chat.completions.create(
        model=param.model,
        messages=[{"role": "user", "content": f"{param.prompt}"}],
        web_search=False
    )
    return {
        "status":200,
        "message": result.choices[0].message.content
    }
    
if not os.path.isdir("frontend"):
    os.makedirs("frontend", exist_ok=True)

app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
