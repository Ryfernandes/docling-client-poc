from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from client import MCPClient

mcp_client = MCPClient(model="claude-sonnet-4-20250514")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    query: str
    context: str

@app.post("/setup/")
async def setup_client():
    print('Setting up MCP client...')
    await mcp_client.connect_to_server("http://localhost:8000/sse")
    return {"message": "Client setup complete."}

@app.post("/message/")
async def send_message(message: ChatMessage):
    print(f"Query: {message.query}, Context: {message.context}")
    (response, context) = await mcp_client.process_monitored_query(message.query, message.context, careful=False)
    return {"response": response, "context": context}