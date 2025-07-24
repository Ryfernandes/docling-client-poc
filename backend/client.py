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
import aiohttp

from docling_core.types.doc.document import (
  DoclingDocument,
  NodeItem,
  RefItem,
  TextItem,
  TableItem,
)

load_dotenv()

class MCPClient:
    def __init__(self, model: str = "claude-3-5-sonnet-20241022"):
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()
        self.anthropic = Anthropic()
        self.max_iterations = 20  # Prevent infinite loops
        self.model = model
        self.context = "None. Start of conversation."
        self.total_cost = 0.0
        self.is_processing = False
        self.cancel_requested = False
    
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

        print("Resetting cost...")
        self.query_cost = 0.0
        self.total_cost = 0.0

    def get_cref_content(self, doc: DoclingDocument, cref: str) -> NodeItem:
        ref = RefItem(cref=cref)
        node = ref.resolve(doc=doc)

        if isinstance(node, TextItem):
            return f"'{node.label}' item. Text at document anchor {cref}: '{node.text}'"
        if isinstance(node, TableItem):
            print(f"Table item selected: {node.export_to_html(doc=doc)}")
            return f"'{node.label}' item. HTML representation of the table at document anchor {cref}: {node.export_to_html(doc=doc)}"
        else:
            return f"'{node.label}' item (no text content)"        

    async def process_monitored_query(self, query: str, seed_document: object, selectedCrefs: list[str], careful: Optional[bool] = True) -> AsyncGenerator[str, None]:
        """Process a query using Claude and available tools with agentic behavior"""
        self.is_processing = True
        self.cancel_requested = False
        
        try:
            # Load the seed document into the context
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "http://localhost:8000/document",
                    json={"document": seed_document}
                ) as resp:
                    await resp.release()

            # Get content from selected crefs
            document = DoclingDocument.model_validate(seed_document)
            selections = [f"{cref}: {self.get_cref_content(document, cref)}" for cref in selectedCrefs]

            messages = []
            self.query_cost = 0

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

            print(f"Using context: {self.context}")
            
            while iteration < self.max_iterations:
                # Check if cancellation was requested
                if self.cancel_requested:
                    yield json.dumps({'type': 'cancelled', 'message': 'Processing was cancelled by request'}) + '\n'
                    break
                    
                iteration += 1

                response = self.anthropic.messages.create(
                    system=[
                        {
                            "type": "text",
                            "text": 
                            """
                            You are a Docling Document creation/editing agent that makes changes to a document that is already provided internally. Avoid repeating lines or mirroring the user's question. Be concise and avoid duplication. 
                            If you encounter an error caused by a user's demand, briefly ask for clarification rather than adjusting the demand.
                            Think carefully about the difference between "adding" items to the end of a document and "inserting" items at a specific position. More often than not, you will want to insert items at a specific position.

                            Consider the following advice when taking actions:
                            - When anchors are removed from a document, all other anchors of the same type change values to stay chronological. This can cause errors in all subsequent operations that require document anchors. To avoid this, delete anchors all at once with a single operation and always make deletion the last step.
                            - Whenever there is a need to replace on element with another, insert the new element at the original position of the old element (using a sibling_anchor) while deleting the old one.
                            - Always make deletion the final step of an operation. This ensures that all other anchors are updated correctly and anchor positions do not shift.
                            """,
                            "cache_control": {"type": "ephemeral"}
                        },
                        {
                            "type": "text",
                            "text": f"Previous conversation context: {self.context}",
                            "cache_control": {"type": "ephemeral"}
                        },
                        {
                            "type": "text",
                            "text": f"The following document anchors have been selected by the user: {', '.join(selections)}. The text of selected text anchors and HTML representations of selected table anchors are also included. Use these to inform your response and only gather more information as necessary.",
                        }
                    ],
                    model=self.model,
                    max_tokens=1000,
                    messages=messages,
                    tools=available_tools,
                )

                cost = self.aggregate_anthropic_response_info(response, display = True)
                yield json.dumps({'type': 'cost', 'cost': cost, 'total': round(self.total_cost, 4), 'kind': 'Agent turn'}) + '\n'

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
                            result_content = result.content[0].dict()
                            
                            if result.isError:
                                raise Exception({result_content['text']})

                            try: 
                              yield json.dumps({'type': 'tool_result', 'content': result_content}) + '\n'
                            except Exception as e:
                                print(f"Error yielding tool result: {e}")

                            result_content = json.loads(result_content['text'])

                            if 'document' in result_content:
                                del result_content['document']
                            print(f"✅ Tool result: {result_content}")

                            content_string = json.dumps(result_content, indent=2)

                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": content.id,
                                "content": content_string,
                            })
                            
                        except Exception as e:
                            print(f"❌ Tool error: {str(e)}")
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
                yield json.dumps({'type': 'max_iterations'}) + '\n'

            print(f"💰 Total Cost: ${round(self.query_cost, 4)}")

            if not self.cancel_requested:
                print("\nSystem: Compressing conversation context...")

                yield json.dumps({'type': 'compressing_context'}) + '\n'
                
                summary = self.anthropic.messages.create(
                    model=self.model,
                    max_tokens=200,
                    messages=messages + [{
                        "role": "user",
                        "content": "Please provide a brief summary of the conversation so far. Make sure to prioritize the user's goals, actions taken, and any important data like document keys that will be important for the continuation of work. List the most recent actions first"
                    }]
                )

                cost = self.aggregate_anthropic_response_info(summary, display = False)
                yield json.dumps({'type': 'cost', 'cost': cost, 'total': round(self.total_cost, 4), 'kind': 'Context compression'}) + '\n'

                self.context = summary.content[0]

                print(f"New context: {self.context}")
        finally:
            self.is_processing = False
            self.cancel_requested = False

    def cancel_processing(self):
        """Request cancellation of the current processing task"""
        if self.is_processing:
            self.cancel_requested = True
            return True
        return False

    def clear_context(self):
        """Clear the conversation context"""
        self.context = "None. Start of conversation."
        print("Context cleared.")

    def aggregate_anthropic_response_info(self, response: Message, display = True) -> float:
        input_tokens_cost = response.usage.input_tokens / 1000000 * 3
        output_tokens_cost = response.usage.output_tokens / 1000000 * 15
        cache_creation_input_tokens_cost = response.usage.cache_creation_input_tokens / 1000000 * 3.75
        cache_read_input_tokens_cost = response.usage.cache_read_input_tokens / 1000000 * 0.3

        total_cost = input_tokens_cost + output_tokens_cost + cache_creation_input_tokens_cost + cache_read_input_tokens_cost

        self.query_cost += total_cost
        self.total_cost += total_cost
        
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
        
        return total_cost

    async def cleanup(self):
        """Clean up resources"""
        await self.exit_stack.aclose()