from pydantic import BaseModel


class GptCreate(BaseModel):
    model: str = "Qwen/Qwen3-14B"
    prompt: str 
    
class GptResult(BaseModel):
    status: int
    message: str 