"""
Pydantic schemas for OpenAI-compatible chat completions API
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Union, Literal
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


# ============================================================================
# Request Schemas
# ============================================================================

# ── Tool-calling schemas ────────────────────────────────────────────────────

class ToolCallFunction(BaseModel):
    """Function invocation inside a tool_call"""
    name: str
    arguments: str  # JSON-encoded string


class ToolCall(BaseModel):
    """A single tool call returned by the model"""
    id: str
    type: str = "function"
    function: ToolCallFunction


class ToolFunctionDefinition(BaseModel):
    """Function schema inside a tool definition"""
    name: str
    description: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None


class ToolDefinition(BaseModel):
    """Tool the model may call (OpenAI format)"""
    type: str = "function"
    function: ToolFunctionDefinition


# ── Messages ────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    """Chat message — supports user, assistant, system, tool roles"""
    role: Literal["system", "user", "assistant", "function", "tool"]
    content: Optional[str] = None  # nullable when assistant returns only tool_calls
    name: Optional[str] = None
    function_call: Optional[Dict[str, Any]] = None
    # Native tool calling fields
    tool_calls: Optional[List[ToolCall]] = None  # assistant → model wants to call tools
    tool_call_id: Optional[str] = None            # tool → links result back to a call


class FunctionDefinition(BaseModel):
    """Legacy function definition (kept for backward compat)"""
    name: str
    description: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None


# ── Request ─────────────────────────────────────────────────────────────────

class ChatCompletionRequest(BaseModel):
    """OpenAI-compatible chat completion request"""
    model: str = Field(..., description="Model ID to use")
    messages: List[ChatMessage] = Field(..., min_length=1)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=1.0, ge=0.0, le=1.0)
    n: int = Field(default=1, ge=1, le=10)
    stream: bool = False
    stop: Optional[Union[str, List[str]]] = None
    max_tokens: Optional[int] = Field(default=None, ge=1, le=32768)
    presence_penalty: float = Field(default=0.0, ge=-2.0, le=2.0)
    frequency_penalty: float = Field(default=0.0, ge=-2.0, le=2.0)
    logit_bias: Optional[Dict[str, float]] = None
    user: Optional[str] = None
    # Native tool calling (preferred)
    tools: Optional[List[ToolDefinition]] = None
    tool_choice: Optional[Union[str, Dict[str, Any]]] = None  # "auto"|"none"|{"type":"function","function":{"name":"..."}}
    # Legacy function calling (backward compat)
    functions: Optional[List[FunctionDefinition]] = None
    function_call: Optional[Union[str, Dict[str, str]]] = None
    
    @field_validator("messages")
    @classmethod
    def validate_messages(cls, v: List[ChatMessage]) -> List[ChatMessage]:
        """Validate messages array"""
        if not v:
            raise ValueError("Messages array cannot be empty")
        # Ensure reasonable content length (content can be None for tool-call messages)
        total_content = sum(len(m.content or "") for m in v)
        if total_content > 500000:  # ~500K characters
            raise ValueError("Total message content exceeds maximum allowed length")
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "model": "llama-3.1-70b-instruct",
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Explain quantum computing"}
                ],
                "temperature": 0.7,
                "max_tokens": 1000,
                "stream": False
            }
        }


class CompletionRequest(BaseModel):
    """OpenAI-compatible text completion request"""
    model: str
    prompt: Union[str, List[str]]
    max_tokens: Optional[int] = Field(default=256, ge=1, le=32768)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=1.0, ge=0.0, le=1.0)
    n: int = Field(default=1, ge=1, le=10)
    stream: bool = False
    logprobs: Optional[int] = None
    echo: bool = False
    stop: Optional[Union[str, List[str]]] = None
    presence_penalty: float = Field(default=0.0, ge=-2.0, le=2.0)
    frequency_penalty: float = Field(default=0.0, ge=-2.0, le=2.0)
    best_of: int = Field(default=1, ge=1, le=10)
    logit_bias: Optional[Dict[str, float]] = None
    user: Optional[str] = None


class EmbeddingRequest(BaseModel):
    """OpenAI-compatible embeddings request"""
    model: str
    input: Union[str, List[str]]
    encoding_format: Literal["float", "base64"] = "float"
    user: Optional[str] = None
    
    @field_validator("input")
    @classmethod
    def validate_input(cls, v: Union[str, List[str]]) -> Union[str, List[str]]:
        """Validate input"""
        if isinstance(v, str):
            if len(v) > 100000:
                raise ValueError("Input text exceeds maximum length")
        elif isinstance(v, list):
            if len(v) > 100:
                raise ValueError("Cannot process more than 100 texts at once")
            for text in v:
                if len(text) > 100000:
                    raise ValueError("Input text exceeds maximum length")
        return v


# ============================================================================
# Response Schemas
# ============================================================================

class ChatCompletionChoice(BaseModel):
    """Chat completion choice"""
    index: int
    message: ChatMessage
    finish_reason: Optional[str] = None  # stop, length, tool_calls, function_call


class ChatCompletionUsage(BaseModel):
    """Token usage information"""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionResponse(BaseModel):
    """OpenAI-compatible chat completion response"""
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[ChatCompletionChoice]
    usage: ChatCompletionUsage
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "chatcmpl-abc123",
                "object": "chat.completion",
                "created": 1706140800,
                "model": "llama-3.1-70b-instruct",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": "Quantum computing is..."
                        },
                        "finish_reason": "stop"
                    }
                ],
                "usage": {
                    "prompt_tokens": 25,
                    "completion_tokens": 150,
                    "total_tokens": 175
                }
            }
        }


class ChatCompletionStreamChoice(BaseModel):
    """Streaming chat completion choice"""
    index: int
    delta: Dict[str, Any]
    finish_reason: Optional[str] = None


class ChatCompletionChunk(BaseModel):
    """Streaming chat completion chunk"""
    id: str
    object: str = "chat.completion.chunk"
    created: int
    model: str
    choices: List[ChatCompletionStreamChoice]


class CompletionChoice(BaseModel):
    """Text completion choice"""
    text: str
    index: int
    logprobs: Optional[Dict[str, Any]] = None
    finish_reason: Optional[str] = None


class CompletionResponse(BaseModel):
    """OpenAI-compatible text completion response"""
    id: str
    object: str = "text_completion"
    created: int
    model: str
    choices: List[CompletionChoice]
    usage: ChatCompletionUsage


class EmbeddingData(BaseModel):
    """Embedding data"""
    object: str = "embedding"
    embedding: List[float]
    index: int


class EmbeddingResponse(BaseModel):
    """OpenAI-compatible embeddings response"""
    object: str = "list"
    data: List[EmbeddingData]
    model: str
    usage: Dict[str, int]
    
    class Config:
        json_schema_extra = {
            "example": {
                "object": "list",
                "data": [
                    {
                        "object": "embedding",
                        "embedding": [0.123, -0.456, 0.789],
                        "index": 0
                    }
                ],
                "model": "bge-large-en-v1.5",
                "usage": {
                    "prompt_tokens": 10,
                    "total_tokens": 10
                }
            }
        }
