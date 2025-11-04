import os 


from g4f.client import AsyncClient

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.schema.schema import GptCreate, GptResult



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


@app.get('/')
async def index():
    with open("frontend/index.html", "r", encoding="utf-8")  as f:
        return f.read()
        