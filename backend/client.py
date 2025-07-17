from typing import Optional, AsyncGenerator
from contextlib import AsyncExitStack

from mcp import ClientSession, StdioServerParameters
from mcp.client.sse import sse_client

from anthropic import Anthropic
from anthropic.types import Message, TextBlock, ToolUseBlock, Usage

from dotenv import load_dotenv
import os

from pydantic import BaseModel

import json

load_dotenv()

class MCPClient:
    def __init__(self, model: str = "claude-3-5-sonnet-20241022"):
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()
        self.anthropic = Anthropic()
        self.max_iterations = 20  # Prevent infinite loops
        self.model = model
        self.context = "None. Start of conversation."
    
    async def connect_to_server(self, server_url: str = "http://localhost:8000/sse"):
        """Connect to an MCP server_script_path

        Args:
            server_url: URL of the SSE server endpoint (default: http://localhost:8000/sse)
        """
        print(f"Connecting to SSE server at: {server_url}")

        sse_transport = await self.exit_stack.enter_async_context(sse_client(server_url))
        self.read, self.write = sse_transport
        self.session = await self.exit_stack.enter_async_context(ClientSession(self.read, self.write))

        await self.session.initialize()

        response = await self.session.list_tools()
        tools = response.tools
        print("\nConnected to server with tools:", [tool.name for tool in tools])

    async def process_monitored_query(self, query: str, careful: Optional[bool] = True) -> AsyncGenerator[str, None]:
        """Process a query using Claude and available tools with agentic behavior"""
        messages = []
        self.query_cost = 0

        messages.append({
            "role": "assistant",
            "content": f"Previous conversation context: {self.context}"
        })

        messages.append({
            "role": "user",
            "content": query
        })

        response = await self.session.list_tools()
        available_tools = [{
            "name": tool.name,
            "description": tool.description,
            "input_schema": tool.inputSchema
        } for tool in response.tools]

        available_tools[-1]["cache_control"] = {"type": "ephemeral"}
        
        execution_log = []
        iteration = 0
        
        while iteration < self.max_iterations:
            iteration += 1

            response = self.anthropic.messages.create(
                system="You are a Docling Document creation/editing agent. Avoid repeating lines or mirroring the user's question. Be concise and avoid duplication.",
                model=self.model,
                max_tokens=1000,
                messages=messages,
                tools=available_tools,
            )

            self.aggregate_anthropic_response_info(response, display = True)

            if careful: 
                quit = input("Quit? ")
                if quit.lower() == 'y':
                    break

            has_tool_calls = False

            assistant_message_content = list(response.content)
            tool_results = []
            
            # Process all content in the response
            for content in response.content:
                if content.type == "text":
                    messages.append({
                        "role": "assistant",
                        "content": content.text
                    })

                    yield json.dumps({'type': 'message', 'content': content.text}) + '\n'
                    
                elif content.type == "tool_use":
                    has_tool_calls = True
                    tool_name = content.name
                    tool_args = content.input
                    
                    print(f"🔧 Calling tool '{tool_name}' with args: {tool_args}")
                    yield json.dumps({'type': 'tool_call', 'name': tool_name, 'args': tool_args}) + '\n'
                    
                    try:
                        result = await self.session.call_tool(tool_name, tool_args)
                        print(f"✅ Tool result: {result.content}")
                        
                        try: 
                          yield json.dumps({'type': 'tool_result', 'content': result.content[0].dict()}) + '\n'
                        except Exception as e:
                            print(f"Error yielding tool result: {e}")

                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": content.id,
                            "content": result.content
                        })
                        
                    except Exception as e:
                        execution_log.append(f"❌ Tool error: {str(e)}")
                        yield json.dumps({'type': 'tool_error', 'content': str(e)}) + '\n'

                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": content.id,
                            "content": f"Error: {str(e)}",
                            "is_error": True
                        })
            
            # If no tool calls were made, we're done
            if has_tool_calls:
                messages.append({"role": "assistant", "content": assistant_message_content})
                messages.append({"role": "user", "content": tool_results})
            else:
                break
        
        if iteration >= self.max_iterations:
            yield "Reached maximum iterations, stopping execution.\n\n"

        print(f"💰 Total Cost: ${round(self.query_cost, 4)}")

        print("\nSystem: Compressing conversation context...")
        
        summary = self.anthropic.messages.create(
            model=self.model,
            max_tokens=200,
            messages=messages + [{
                "role": "user",
                "content": "Please provide a brief summary of the conversation so far. Make sure to prioritize the user's goals, actions taken, and any important data like document keys that will be important for the continuation of work. List the most recent actions first"
            }]
        )

        self.context = summary.content[0]

        print(f"New context: {self.context}")
    
    def clear_context(self):
        """Clear the conversation context"""
        self.context = "None. Start of conversation."
        print("Context cleared.")

    def aggregate_anthropic_response_info(self, response: Message, display = True):
        input_tokens_cost = response.usage.input_tokens / 1000000 * 3
        output_tokens_cost = response.usage.output_tokens / 1000000 * 15
        cache_creation_input_tokens_cost = response.usage.cache_creation_input_tokens / 1000000 * 3.75
        cache_read_input_tokens_cost = response.usage.cache_read_input_tokens / 1000000 * 0.3

        self.query_cost += input_tokens_cost + output_tokens_cost + cache_creation_input_tokens_cost + cache_read_input_tokens_cost
        
        if display:
            print(f"\n🆔 ID: {response.id}")
            print(f"🧠 Model: {response.model}")
            print(f"👤 Role: {response.role}")
            print(f"📍 Type: {response.type}")
            print(f"⛔ Stop Reason: {response.stop_reason}")
            print(f"🔚 Stop Sequence: {response.stop_sequence}\n")
        
            print("🧾 Content Blocks:")
            for i, block in enumerate(response.content):
                print(f"\n  🔹 Block {i + 1}:")
                if isinstance(block, TextBlock):
                    print("    📄 Type: TextBlock")
                    print(f"    🔤 Text: {block.text}")
                    print(f"    📚 Citations: {block.citations}")
                elif isinstance(block, ToolUseBlock):
                    print("    🛠️ Type: ToolUseBlock")
                    print(f"    🆔 ToolUse ID: {block.id}")
                    print(f"    🔧 Tool Name: {block.name}")
                    print(f"    📥 Input: {block.input}")
                else:
                    print(f"    ❓ Unknown block type: {type(block)}")
                    
            print("\n💸 Usage/Cost:")
            print(f"  🔢 Input Tokens: {response.usage.input_tokens} tokens at $3/MTok = ${round(input_tokens_cost, 4)}")
            print(f"  🔢 Output Tokens: {response.usage.output_tokens} tokens at $15/MTok = ${round(output_tokens_cost, 4)}")
            print(f"  🪪 Service Tier: {response.usage.service_tier}")
            print(f"  🗂️ Cache Creation Tokens: {response.usage.cache_creation_input_tokens} tokens at $3.75/MTok = ${round(cache_creation_input_tokens_cost, 4)}")
            print(f"  🗂️ Cache Read Tokens: {response.usage.cache_read_input_tokens} tokens at $0.30/MTok = ${round(cache_read_input_tokens_cost, 4)}")
            print(f"  🧰 Server Tool Use: {response.usage.server_tool_use}")

    async def cleanup(self):
        """Clean up resources"""
        await self.exit_stack.aclose()