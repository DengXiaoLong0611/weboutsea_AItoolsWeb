# LangGraph Streaming Detailed interpretation

## 📚 Overview

This document explains in detail the **Streaming (streaming output)** technology in LangGraph. Streaming is a core capability for building interactive AI applications. It allows us to obtain output in real time during Graph execution instead of waiting for the entire process to complete. This is crucial to improving user experience and realizing human-computer interaction.

## 🎯 Core Concept

### What is Streaming?

Streaming refers to the technology of gradually outputting results during program execution:

**Traditional way (non-streaming):**
```
用户提问 → [等待...] → 完整答案一次性返回
```

**Streaming method:**
```
用户提问 → 第一个词 → 第二个词 → ... → 完成
               ↓         ↓           ↓
            实时显示  实时显示    实时显示
```

### Why do you need Streaming?

1. **Better user experience**
   - Typewriter effect similar to ChatGPT
   - Let users know the system is working
   - Reduce waiting anxiety

2. **Real-time monitoring**
   - Observe the execution process of Graph
   - Debug the output of each node
   - Track status changes

3. **Basics of human-computer interaction**
   - pause during execution
   - Allow users to confirm or modify
   - Implement Human-in-the-loop

---

## 🎭 Practical case: Chat robot with memory

We will build a complete chatbot that demonstrates all of LangGraph’s Streaming modes.

### System architecture

```
START
  ↓
[conversation] 调用 LLM
  ↓
判断消息数量
  ↓
├─ ≤ 6 条 → END
└─ > 6 条 → [summarize_conversation] → END
              (总结并删除旧消息)
```

**Core features:**
1. Support multiple rounds of dialogue
2. Automatically summarize long conversations
3. Support multiple streaming output modes

---

## 🔧 Detailed explanation of code implementation

### 1. Environment configuration

```python
import os, getpass

def _set_env(var: str):
    if not os.environ.get(var):
        os.environ[var] = getpass.getpass(f"{var}: ")

_set_env("OPENAI_API_KEY")
```

**Instructions:** Set API keys securely and avoid hardcoding them in your code.

---

### 2. Define status

```python
from langgraph.graph import MessagesState

class State(MessagesState):
    summary: str
```

**LangGraph knowledge point: MessagesState**

`MessagesState` is LangGraph's built-in state class, specially designed for chat applications:

```python
class MessagesState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
```

**Key Features:**
- `messages` fields automatically use the `add_messages` reducer
- Supports intelligent message merging and deduplication
- Handle special operations such as `RemoveMessage`

**Our extensions:**
```python
class State(MessagesState):
    summary: str  # 添加对话摘要字段
```

---

### 3. Core node: call_model

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.runnables import RunnableConfig

model = ChatOpenAI(model="gpt-4o", temperature=0)

def call_model(state: State, config: RunnableConfig):
    # 获取摘要（如果存在）
    summary = state.get("summary", "")

    # 如果有摘要，添加到系统消息
    if summary:
        system_message = f"Summary of conversation earlier: {summary}"
        messages = [SystemMessage(content=system_message)] + state["messages"]
    else:
        messages = state["messages"]

    # 调用模型
    response = model.invoke(messages, config)
    return {"messages": response}
```

**Python knowledge points: RunnableConfig**

`RunnableConfig` is the configuration object of LangChain and is used for:
- Pass runtime configuration (such as callbacks)
- Enable Token streaming output (Python < 3.11)
- Pass metadata

```python
# 为什么需要 config 参数？
# 1. 启用 token-level streaming
# 2. 传递回调函数
# 3. 配置超时、重试等
```

**Summary Mechanism:**
1. If a summary exists, add it as a system message to the beginning of the conversation
2. This way LLM can understand the content of previous conversations
3. But there is no need to process complete historical messages (save tokens)

---

### 4. Summary node: summarize_conversation

```python
from langchain_core.messages import RemoveMessage

def summarize_conversation(state: State):
    # 获取现有摘要
    summary = state.get("summary", "")

    # 创建摘要提示
    if summary:
        summary_message = (
            f"This is summary of the conversation to date: {summary}\n\n"
            "Extend the summary by taking into account the new messages above:"
        )
    else:
        summary_message = "Create a summary of the conversation above:"

    # 添加提示到消息列表
    messages = state["messages"] + [HumanMessage(content=summary_message)]
    response = model.invoke(messages)

    # 删除除最后 2 条之外的所有消息
    delete_messages = [RemoveMessage(id=m.id) for m in state["messages"][:-2]]

    return {"summary": response.content, "messages": delete_messages}
```

**LangGraph knowledge point: RemoveMessage**

`RemoveMessage` is a special message type used to remove messages from a state:

```python
# 创建删除消息
RemoveMessage(id=message_id)

# add_messages reducer 会自动处理
# 当遇到 RemoveMessage 时，会从状态中删除对应的消息
```

**Why do you need to delete messages? **
- Avoid infinite growth of message list
- Save memory and token costs
- Keep conversation windows under control

**Summary Strategy:**
1. Keep the last 2 messages (latest interactions)
2. Delete other old messages
3. Replace deleted content with summaries

---

### 5. Conditional judgment: should_continue

```python
from langgraph.graph import END

def should_continue(state: State):
    """决定下一个节点"""
    messages = state["messages"]

    # 如果消息超过 6 条，进行总结
    if len(messages) > 6:
        return "summarize_conversation"

    # 否则结束
    return END
```

**LangGraph knowledge point: conditional edge return value**

Conditional functions can return:
1. **Node name** (string): `"summarize_conversation"`
2. **Special constants**: `END`, `START`
3. **Send object**: used for dynamic parallelism (learn in the next lesson)

```python
# 示例
graph.add_conditional_edges(
    "conversation",      # 源节点
    should_continue,     # 条件函数
    {                    # 路由映射
        "summarize_conversation": "summarize_conversation",
        END: END
    }
)

# 简化写法（如果返回值就是节点名）
graph.add_conditional_edges("conversation", should_continue)
```

---

### 6. Build Graph

```python
from langgraph.graph import StateGraph, START
from langgraph.checkpoint.memory import MemorySaver

# 创建图
workflow = StateGraph(State)

# 添加节点
workflow.add_node("conversation", call_model)
workflow.add_node(summarize_conversation)

# 添加边
workflow.add_edge(START, "conversation")
workflow.add_conditional_edges("conversation", should_continue)
workflow.add_edge("summarize_conversation", END)

# 编译（带 checkpointer）
memory = MemorySaver()
graph = workflow.compile(checkpointer=memory)
```

**LangGraph knowledge point: Checkpointer**

`MemorySaver` is an in-memory checkpointer used for:
- Save the status of each node after execution
- Support multiple rounds of dialogue (via thread_id)
- Enable Streaming and Interruption functions

```python
# Checkpointer 的作用
graph = workflow.compile(checkpointer=memory)
#                        ^^^^^^^^^^^^^^^^^^^^
#                        没有这个，无法：
#                        1. 保持对话状态
#                        2. 使用 thread_id
#                        3. 实现 human-in-the-loop
```

---

## 🌊 Detailed explanation of Streaming mode

LangGraph supports multiple streaming modes, each providing different granularity of output.

### Mode 1: stream_mode="updates"

**Features:** Only the **status update** after node execution is returned

```python
config = {"configurable": {"thread_id": "1"}}

for chunk in graph.stream(
    {"messages": [HumanMessage(content="hi! I'm Lance")]},
    config,
    stream_mode="updates"
):
    print(chunk)
```

**Output:**
```python
{
    'conversation': {
        'messages': AIMessage(
            content='Hi Lance! How can I assist you today?',
            id='run-6d58e31e-...'
        )
    }
}
```

**Output structure:**
```python
{
    '节点名称': {
        '更新的状态字段': 新值
    }
}
```

**Applicable scenarios:**
- Only care about status changes
- No complete status required
- Reduce the amount of output data

**More elegant way to use:**
```python
for chunk in graph.stream(..., stream_mode="updates"):
    chunk['conversation']["messages"].pretty_print()
```

Output:
```
================================== Ai Message ==================================
Hi Lance! How are you doing today?
```

---

### Mode 2: stream_mode="values"

**Features:** Return the **complete status** after node execution

```python
config = {"configurable": {"thread_id": "2"}}
input_message = HumanMessage(content="hi! I'm Lance")

for event in graph.stream(
    {"messages": [input_message]},
    config,
    stream_mode="values"
):
    for m in event['messages']:
        m.pretty_print()
    print("---" * 25)
```

**Output:**
```
================================ Human Message =================================
hi! I'm Lance
---------------------------------------------------------------------------
================================ Human Message =================================
hi! I'm Lance
================================== Ai Message ==================================
Hi Lance! How can I assist you today?
---------------------------------------------------------------------------
```

**Key differences:**

| properties | updates | values |
|------|---------|--------|
| Output content | Updated parts only | Complete status |
| Number of outputs | 1 time for each node | 1 time for each node (including cumulative status) |
| Data volume | Small | Large |
| Purpose | Incremental update | Status check, debugging |

**Why are values ​​output twice? **

1. **First time**: Initial state (only user messages)
2. **Second time**: After the conversation node is executed (user message + AI reply)

This is the characteristic of `values` mode: complete status is output before and after each node.

---

### Mode 3: astream_events (Token Streaming)⭐

**Features:** Streaming output**Chat model token** (closest to the effect of ChatGPT)

```python
config = {"configurable": {"thread_id": "3"}}
input_message = HumanMessage(content="Tell me about the 49ers NFL team")

async for event in graph.astream_events(
    {"messages": [input_message]},
    config,
    version="v2"
):
    print(f"Node: {event['metadata'].get('langgraph_node', '')}")
    print(f"Type: {event['event']}")
    print(f"Name: {event['name']}")
```

**Python knowledge points: async/await**

```python
async for event in graph.astream_events(...):
    #^^^^                  ^^^^^^^^^^^^
    # 异步循环              异步方法
```

**Why is asynchronous required? **
- Streaming is an I/O intensive operation
- Async can handle other tasks while waiting
- LangChain/LangGraph’s streaming is based on asynchronous

**Basic concepts:**
```python
# 同步（阻塞）
for item in sync_generator():
    process(item)  # 等待每一项

# 异步（非阻塞）
async for item in async_generator():
    await process(item)  # 等待时可以切换任务
```

**Event Type:**

astream_events will output **all** events during graph execution:

```
Node: . Type: on_chain_start. Name: LangGraph
Node: conversation. Type: on_chain_start. Name: RunnableSequence
Node: conversation. Type: on_prompt_start. Name: ChatPromptTemplate
Node: conversation. Type: on_prompt_end. Name: ChatPromptTemplate
Node: conversation. Type: on_chat_model_start. Name: ChatOpenAI
Node: conversation. Type: on_chat_model_stream. Name: ChatOpenAI  ← 这个！
Node: conversation. Type: on_chat_model_stream. Name: ChatOpenAI  ← 这个！
Node: conversation. Type: on_chat_model_stream. Name: ChatOpenAI  ← 这个！
...
```

**Key event: `on_chat_model_stream`**

This is what we are looking for! It contains every token generated by LLM.

---

### Filter Token events

```python
node_to_stream = 'conversation'
config = {"configurable": {"thread_id": "4"}}
input_message = HumanMessage(content="Tell me about the 49ers NFL team")

async for event in graph.astream_events(
    {"messages": [input_message]},
    config,
    version="v2"
):
    # 过滤条件：
    # 1. 事件类型是 on_chat_model_stream
    # 2. 来自我们关心的节点
    if (event["event"] == "on_chat_model_stream" and
        event['metadata'].get('langgraph_node', '') == node_to_stream):
        print(event["data"])
```

**Output structure:**
```python
{
    'chunk': AIMessageChunk(content='The', id='run-...')
}
```

**Extract Token:**
```python
async for event in graph.astream_events(...):
    if event["event"] == "on_chat_model_stream" and ....:
        data = event["data"]
        print(data["chunk"].content, end="|")
```

**Output effect:**
```
The| San| Francisco| |49|ers| are| a| professional| American| football| team|...
```

**Achieve typewriter effect:**
```python
import sys

async for event in graph.astream_events(...):
    if event["event"] == "on_chat_model_stream":
        token = event["data"]["chunk"].content
        print(token, end="", flush=True)
        #                      ^^^^^^^^^^
        #                      立即输出，不缓冲
```

---

## 🌐 Streaming using LangGraph API

LangGraph provides deployment and API service capabilities, and supports streaming through HTTP.

### Start local development server

```bash
cd /path/to/studio
langgraph dev
```

**Output:**
```
- 🚀 API: http://127.0.0.1:2024
- 🎨 Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- 📚 API Docs: http://127.0.0.1:2024/docs
```

---

### Connect to API

```python
from langgraph_sdk import get_client

URL = "http://127.0.0.1:2024"
client = get_client(url=URL)

# 查看所有 assistants（图）
assistants = await client.assistants.search()
```

**LangGraph knowledge points: Assistants**

In the LangGraph API:
- **Assistant** = a compiled Graph
- Can deploy multiple assistants
- Each assistant has independent configuration

---

### API Streaming: Values ​​mode

```python
# 创建线程
thread = await client.threads.create()

# 流式执行
input_message = HumanMessage(content="Multiply 2 and 3")
async for event in client.runs.stream(
    thread["thread_id"],
    assistant_id="agent",
    input={"messages": [input_message]},
    stream_mode="values"
):
    print(event)
```

**Output:**
```python
StreamPart(event='metadata', data={'run_id': '1ef6a3d0-...'})
StreamPart(event='values', data={'messages': [...]})
StreamPart(event='values', data={'messages': [..., tool_call_message]})
StreamPart(event='values', data={'messages': [..., tool_result]})
StreamPart(event='values', data={'messages': [..., final_answer]})
```

**StreamPart structure:**
```python
StreamPart(
    event='...',  # 事件类型
    data={...}    # 状态数据
)
```

**Extract message:**
```python
from langchain_core.messages import convert_to_messages

async for event in client.runs.stream(...):
    messages = event.data.get('messages', None)
    if messages:
        # 转换为 LangChain 消息对象
        converted = convert_to_messages(messages)
        print(converted[-1])  # 最新消息
    print('=' * 25)
```

---

### API Streaming: Messages pattern ⭐

**This is an API-exclusive mode! ** Not supported by native graph.stream().

**Features:**
- Optimized for chat applications
- Automatically handle incremental updates of messages
- More fine-grained token streaming

```python
thread = await client.threads.create()
input_message = HumanMessage(content="Multiply 2 and 3")

async for event in client.runs.stream(
    thread["thread_id"],
    assistant_id="agent",
    input={"messages": [input_message]},
    stream_mode="messages"
):
    print(event.event)
```

**Output:**
```
metadata
messages/complete
messages/metadata
messages/partial  ← Token 流
messages/partial
messages/partial
...
messages/complete
```

**Event Type:**

| Event | Meaning | Data |
|------|------|------|
| `metadata` | Run metadata | run_id etc. |
| `messages/complete` | Complete message | Complete message object |
| `messages/partial` | Part of the message | Token or part of the content |
| `messages/metadata` | Message metadata | finish_reason, etc. |

---

### Handle Messages event

```python
def format_tool_calls(tool_calls):
    """格式化工具调用"""
    if tool_calls:
        formatted_calls = []
        for call in tool_calls:
            formatted_calls.append(
                f"Tool Call ID: {call['id']}, "
                f"Function: {call['name']}, "
                f"Arguments: {call['args']}"
            )
        return "\n".join(formatted_calls)
    return "No tool calls"

async for event in client.runs.stream(..., stream_mode="messages"):
    # 处理元数据
    if event.event == "metadata":
        print(f"Metadata: Run ID - {event.data['run_id']}")
        print("-" * 50)

    # 处理部分消息（Token 流）
    elif event.event == "messages/partial":
        for data_item in event.data:
            # 用户消息
            if "role" in data_item and data_item["role"] == "user":
                print(f"Human: {data_item['content']}")

            # AI 响应
            else:
                tool_calls = data_item.get("tool_calls", [])
                content = data_item.get("content", "")
                response_metadata = data_item.get("response_metadata", {})

                if content:
                    print(f"AI: {content}")

                if tool_calls:
                    print("Tool Calls:")
                    print(format_tool_calls(tool_calls))

                if response_metadata:
                    finish_reason = response_metadata.get("finish_reason", "N/A")
                    print(f"Response Metadata: Finish Reason - {finish_reason}")

        print("-" * 50)
```

**Output effect:**
```
Metadata: Run ID - 1ef6a3da-687f-6253-915a-701de5327165
--------------------------------------------------
Tool Calls:
Tool Call ID: call_IL4M..., Function: multiply, Arguments: {}
--------------------------------------------------
Tool Calls:
Tool Call ID: call_IL4M..., Function: multiply, Arguments: {'a': 2}
--------------------------------------------------
Tool Calls:
Tool Call ID: call_IL4M..., Function: multiply, Arguments: {'a': 2, 'b': 3}
Response Metadata: Finish Reason - tool_calls
--------------------------------------------------
AI: The
--------------------------------------------------
AI: The result
--------------------------------------------------
AI: The result of
--------------------------------------------------
AI: The result of multiplying
--------------------------------------------------
...
AI: The result of multiplying 2 and 3 is 6.
Response Metadata: Finish Reason - stop
--------------------------------------------------
```

**Points to observe:**
1. The parameters called by the tool are generated step by step: `{}` → `{'a': 2}` → `{'a': 2, 'b': 3}`
2. The AI reply is generated token by token: `The` → `The result` → ...
3. Metadata such as finish_reason can be obtained

---

## 🎓 Summary of core knowledge points

### LangGraph-specific concepts

#### 1. Streaming mode comparison

| Mode | Output Content | Granularity | Usage |
|------|---------|------|------|
| `updates` | Status update | Node level | Track status changes |
| `values` | Complete status | Node level | Debugging, status check |
| `astream_events` | All events | Event level | Token streaming |
| `messages` (API) | Message flow | Token level | Chat application |

#### 2. Local vs API Streaming

| Features | Local (graph.stream) | API (client.runs.stream) |
|------|-------------------|------------------------|
| `updates` | ✅ | ✅ |
| `values` | ✅ | ✅ |
| `astream_events` | ✅ | ❌ |
| `messages` | ❌ | ✅ (Recommended) |
| Deployment requirements | None | Requires LangGraph Server |

#### 3. MessagesState

```python
class MessagesState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
```

**Features:**
- Automatic message merging
- Support RemoveMessage
- Deduplication and sorting

#### 4. RemoveMessage

```python
# 创建删除指令
delete_messages = [RemoveMessage(id=m.id) for m in old_messages]

# 返回更新
return {"messages": delete_messages}

# add_messages reducer 会自动处理删除
```

#### 5. Checkpointer

```python
from langgraph.checkpoint.memory import MemorySaver

memory = MemorySaver()
graph = workflow.compile(checkpointer=memory)

# 使用 thread_id 隔离对话
config = {"configurable": {"thread_id": "user123"}}
```

**Function:**
- Save status snapshot
-Support multiple rounds of dialogue
- Enable interruption (next lesson)

---

### Python-specific knowledge points

#### 1. async/await basics

```python
# 定义异步函数
async def fetch_data():
    return await some_async_operation()

# 调用异步函数
result = await fetch_data()

# 异步循环
async for item in async_generator():
    process(item)
```

**Key concepts:**
- `async def`: Define asynchronous functions
- `await`: Wait for asynchronous operation to complete
- `async for`: Asynchronous iteration

**Why is asynchronous required? **
```python
# 同步（阻塞）- 总时间：3秒
result1 = fetch_url1()  # 1秒
result2 = fetch_url2()  # 1秒
result3 = fetch_url3()  # 1秒

# 异步（并发）- 总时间：1秒
results = await asyncio.gather(
    fetch_url1(),
    fetch_url2(),
    fetch_url3()
)
```

#### 2. RunnableConfig

```python
from langchain_core.runnables import RunnableConfig

def my_node(state: State, config: RunnableConfig):
    # 访问配置
    thread_id = config["configurable"]["thread_id"]

    # 传递给 LLM（启用 streaming）
    response = model.invoke(messages, config)

    return {"messages": response}
```

**Use:**
- Pass callbacks
- Configure streaming
- Timeout and retry settings

#### 3. dict.get() default value

```python
summary = state.get("summary", "")
#                              ^^^
#                              默认值（如果 key 不存在）

# 等价于：
if "summary" in state:
    summary = state["summary"]
else:
    summary = ""
```

#### 4. List comprehension

```python
# 创建删除消息列表
delete_messages = [RemoveMessage(id=m.id) for m in state["messages"][:-2]]
#                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
#                  对每个消息创建 RemoveMessage 对象

# 等价于：
delete_messages = []
for m in state["messages"][:-2]:  # 除最后2条外的所有消息
    delete_messages.append(RemoveMessage(id=m.id))
```

#### 5. Slicing operation

```python
messages = [m1, m2, m3, m4, m5]

messages[-2:]   # 最后2个：[m4, m5]
messages[:-2]   # 除最后2个：[m1, m2, m3]
messages[:3]    # 前3个：[m1, m2, m3]
messages[1:4]   # 索引1-3：[m2, m3, m4]
```

---

## 💡 Best Practices

### 1. Choose the appropriate streaming mode

**Scenario 1: Chat Application**
```python
# ✅ 推荐：messages 模式（如果使用 API）
async for event in client.runs.stream(..., stream_mode="messages")

# ✅ 或：astream_events（本地）
async for event in graph.astream_events(..., version="v2"):
    if event["event"] == "on_chat_model_stream":
        print(event["data"]["chunk"].content, end="")
```

**Scenario 2: Debugging and Development**
```python
# ✅ 推荐：values 模式
for event in graph.stream(..., stream_mode="values"):
    print(event)  # 查看完整状态
```

**Scenario 3: Status Monitoring**
```python
# ✅ 推荐：updates 模式
for chunk in graph.stream(..., stream_mode="updates"):
    for node, update in chunk.items():
        print(f"{node} updated: {update}")
```

---

### 2. Token Streaming Best Practices

```python
async def stream_response(graph, input_message, node_name="conversation"):
    """优雅的 token streaming 封装"""

    config = {"configurable": {"thread_id": generate_thread_id()}}

    async for event in graph.astream_events(
        {"messages": [input_message]},
        config,
        version="v2"
    ):
        # 过滤目标节点的 token 事件
        if (event["event"] == "on_chat_model_stream" and
            event["metadata"].get("langgraph_node") == node_name):

            token = event["data"]["chunk"].content
            if token:  # 避免空 token
                yield token

# 使用
async for token in stream_response(graph, user_message):
    print(token, end="", flush=True)
```

---

### 3. Error handling

```python
async def safe_stream(graph, input_data, config):
    """带错误处理的 streaming"""

    try:
        async for event in graph.astream_events(input_data, config, version="v2"):
            if event["event"] == "on_chat_model_stream":
                yield event["data"]["chunk"].content

    except Exception as e:
        print(f"\n[错误] Streaming 中断: {e}")
        # 可以选择返回部分结果或重试
        raise

# 使用
try:
    async for token in safe_stream(graph, input_data, config):
        print(token, end="")
except Exception:
    print("\n[系统] 请稍后重试")
```

---

### 4. Conversation history management

```python
class ConversationManager:
    """管理对话历史和摘要"""

    def __init__(self, max_messages=6):
        self.max_messages = max_messages

    def should_summarize(self, state: State) -> bool:
        """判断是否需要总结"""
        return len(state["messages"]) > self.max_messages

    def get_messages_to_keep(self, messages, keep_last=2):
        """获取要保留的消息"""
        return messages[-keep_last:]

    def get_messages_to_delete(self, messages, keep_last=2):
        """获取要删除的消息"""
        return [RemoveMessage(id=m.id) for m in messages[:-keep_last]]

# 使用
manager = ConversationManager(max_messages=10)

def should_continue(state: State):
    if manager.should_summarize(state):
        return "summarize_conversation"
    return END
```

---

### 5. Thread management

```python
import uuid

def create_thread_config(user_id: str, conversation_id: str = None):
    """创建线程配置"""

    # 使用用户 ID + 对话 ID 作为 thread_id
    if conversation_id is None:
        conversation_id = str(uuid.uuid4())

    thread_id = f"{user_id}:{conversation_id}"

    return {
        "configurable": {
            "thread_id": thread_id
        }
    }

# 使用
config = create_thread_config(user_id="alice", conversation_id="chat-001")
for event in graph.stream(input_data, config, stream_mode="updates"):
    ...
```

---

## 🚀 Advanced skills

### 1. Multi-node Token Streaming

If there are multiple chat model nodes in the Graph, they can be streamed separately:

```python
async def stream_all_nodes(graph, input_data, config):
    """Stream 所有节点的 tokens"""

    async for event in graph.astream_events(input_data, config, version="v2"):
        if event["event"] == "on_chat_model_stream":
            node_name = event["metadata"].get("langgraph_node", "unknown")
            token = event["data"]["chunk"].content

            # 根据节点区分输出
            print(f"[{node_name}] {token}", end="", flush=True)
```

---

### 2. Real-time progress display

```python
import sys

async def stream_with_progress(graph, input_data, config):
    """带进度提示的 streaming"""

    current_node = None

    async for event in graph.astream_events(input_data, config, version="v2"):
        # 节点开始
        if event["event"] == "on_chain_start":
            new_node = event["metadata"].get("langgraph_node")
            if new_node and new_node != current_node:
                current_node = new_node
                print(f"\n\n[{current_node}] ", end="", flush=True)

        # Token 输出
        elif event["event"] == "on_chat_model_stream":
            token = event["data"]["chunk"].content
            print(token, end="", flush=True)
```

---

### 3. Conditional Streaming

```python
async def conditional_stream(graph, input_data, config, stream_tokens=True):
    """根据条件决定是否 stream tokens"""

    if stream_tokens:
        # Token-level streaming
        async for event in graph.astream_events(input_data, config, version="v2"):
            if event["event"] == "on_chat_model_stream":
                yield event["data"]["chunk"].content
    else:
        # Node-level streaming
        async for chunk in graph.astream(input_data, config):
            yield chunk
```

---

### 4. Caching and Replay

```python
class StreamCache:
    """缓存 streaming 输出，支持重放"""

    def __init__(self):
        self.cache = []

    async def stream_and_cache(self, graph, input_data, config):
        """Stream 并缓存"""
        self.cache.clear()

        async for event in graph.astream_events(input_data, config, version="v2"):
            if event["event"] == "on_chat_model_stream":
                token = event["data"]["chunk"].content
                self.cache.append(token)
                yield token

    def replay(self, delay=0.05):
        """重放缓存的输出"""
        import time
        for token in self.cache:
            print(token, end="", flush=True)
            time.sleep(delay)

# 使用
cache = StreamCache()
async for token in cache.stream_and_cache(graph, input_data, config):
    print(token, end="")

# 稍后重放
cache.replay(delay=0.1)
```

---

## 📊 Streaming performance optimization

### 1. Reduce event filtering overhead

```python
# ❌ 不高效 - 每次都检查多个条件
async for event in graph.astream_events(...):
    if (event["event"] == "on_chat_model_stream" and
        event["metadata"].get("langgraph_node") == "conversation" and
        event["data"] is not None and
        "chunk" in event["data"]):
        ...

# ✅ 高效 - 提前准备条件
target_event = "on_chat_model_stream"
target_node = "conversation"

async for event in graph.astream_events(...):
    if event["event"] == target_event:
        if event["metadata"].get("langgraph_node") == target_node:
            token = event["data"]["chunk"].content
            if token:
                yield token
```

---

### 2. Batch processing of Tokens

```python
async def batch_stream(graph, input_data, config, batch_size=5):
    """批量输出 tokens，减少 I/O"""

    buffer = []

    async for event in graph.astream_events(input_data, config, version="v2"):
        if event["event"] == "on_chat_model_stream":
            token = event["data"]["chunk"].content
            buffer.append(token)

            if len(buffer) >= batch_size:
                yield "".join(buffer)
                buffer.clear()

    # 输出剩余 tokens
    if buffer:
        yield "".join(buffer)

# 使用
async for batch in batch_stream(graph, input_data, config):
    print(batch, end="", flush=True)
```

---

## 🎯 Practical application cases

### Case 1: Chatbot Web Application

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()

@app.post("/chat/stream")
async def chat_stream(message: str, user_id: str):
    """SSE (Server-Sent Events) 流式聊天"""

    async def event_generator():
        config = {"configurable": {"thread_id": user_id}}
        input_msg = HumanMessage(content=message)

        async for event in graph.astream_events(
            {"messages": [input_msg]},
            config,
            version="v2"
        ):
            if event["event"] == "on_chat_model_stream":
                token = event["data"]["chunk"].content
                if token:
                    # SSE 格式
                    yield f"data: {token}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

---

### Case 2: Command line chat tool

```python
import asyncio
from rich.console import Console
from rich.markdown import Markdown

console = Console()

async def cli_chat():
    """命令行聊天界面"""

    config = {"configurable": {"thread_id": "cli-session"}}

    while True:
        # 用户输入
        user_input = console.input("\n[bold green]You:[/bold green] ")
        if user_input.lower() in ["exit", "quit"]:
            break

        # AI 响应
        console.print("[bold blue]AI:[/bold blue] ", end="")

        response_text = ""
        async for event in graph.astream_events(
            {"messages": [HumanMessage(content=user_input)]},
            config,
            version="v2"
        ):
            if event["event"] == "on_chat_model_stream":
                token = event["data"]["chunk"].content
                if token:
                    console.print(token, end="", style="blue")
                    response_text += token

        print()  # 换行

# 运行
asyncio.run(cli_chat())
```

---

### Case 3: Multi-user concurrent chat

```python
import asyncio
from collections import defaultdict

class MultiUserChatManager:
    """管理多用户并发聊天"""

    def __init__(self, graph):
        self.graph = graph
        self.active_streams = defaultdict(int)

    async def stream_for_user(self, user_id: str, message: str):
        """为特定用户 stream 响应"""

        config = {"configurable": {"thread_id": user_id}}
        self.active_streams[user_id] += 1

        try:
            async for event in self.graph.astream_events(
                {"messages": [HumanMessage(content=message)]},
                config,
                version="v2"
            ):
                if event["event"] == "on_chat_model_stream":
                    token = event["data"]["chunk"].content
                    if token:
                        yield {
                            "user_id": user_id,
                            "token": token,
                            "timestamp": event["data"].get("timestamp")
                        }
        finally:
            self.active_streams[user_id] -= 1

    def get_active_users(self):
        """获取活跃用户列表"""
        return [uid for uid, count in self.active_streams.items() if count > 0]

# 使用
manager = MultiUserChatManager(graph)

# 并发处理多个用户
async def handle_multiple_users():
    async with asyncio.TaskGroup() as tg:
        tg.create_task(process_user("alice", "Hello!"))
        tg.create_task(process_user("bob", "Hi there!"))
        tg.create_task(process_user("charlie", "Good morning!"))

async def process_user(user_id, message):
    async for data in manager.stream_for_user(user_id, message):
        print(f"[{data['user_id']}] {data['token']}", end="")
```

---

## 📖 Further reading

- [LangGraph Streaming official document](https://langchain-ai.github.io/langgraph/concepts/low_level/#streaming)
- [LangGraph API Streaming Documentation](https://langchain-ai.github.io/langgraph/cloud/how-tos/stream-values/)
- [Python Async/Await Tutorial](https://realpython.com/async-io-python/)
- [Server-Sent Events (SSE) Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)

---

## 🔍 Frequently Asked Questions

### Q1: Why does astream_events require version="v2"?

**Answer:** `astream_events` has two versions:
- **v1** (old): event structure is different, deprecated
- **v2** (new): standardized event structure, recommended

```python
# ✅ 正确
async for event in graph.astream_events(..., version="v2")

# ❌ 不推荐
async for event in graph.astream_events(...)  # 默认 v1
```

---

### Q2: What is the difference between stream and astream?

| Method | Type | Return | Usage |
|------|------|------|------|
| `stream()` | Sync | Generator | `for chunk in graph.stream(...)` |
| `astream()` | Asynchronous | Asynchronous Generator | `async for chunk in graph.astream(...)` |

**Performance Difference:**
- Similar performance for a single request
- For concurrent scenarios, `astream` is more efficient

---

### Q3: How to use async in Jupyter Notebook?

Jupyter has a built-in event loop and you can use `await` directly:

```python
# Jupyter 中可以直接这样写
async for event in graph.astream_events(...):
    print(event)

# 或
result = await some_async_function()
```

In a normal Python script, one would need:
```python
import asyncio

asyncio.run(main())
```

---

### Q4: Why does token streaming sometimes output an empty string?

LLM may generate empty tokens during the generation process (such as internal reasoning steps), which need to be filtered:

```python
# ✅ 过滤空 token
async for event in graph.astream_events(...):
    if event["event"] == "on_chat_model_stream":
        token = event["data"]["chunk"].content
        if token:  # 检查非空
            print(token, end="")
```

---

### Q5: How to get the complete message in the stream process?

**Method 1: Accumulate tokens**
```python
full_response = ""
async for event in graph.astream_events(...):
    if event["event"] == "on_chat_model_stream":
        token = event["data"]["chunk"].content
        full_response += token
        print(token, end="")

print(f"\n\n完整响应: {full_response}")
```

**Method 2: Listen on_chat_model_end**
```python
async for event in graph.astream_events(...):
    if event["event"] == "on_chat_model_end":
        full_message = event["data"]["output"]
        print(f"完整消息: {full_message.content}")
```

---

### Q6: Why is the messages mode only available in the API?

`messages` mode is a special optimization of LangGraph API Server, designed specifically for chat applications:
- Automatically handle message differences
- More efficient network transmission
- Easier integration with front-end frameworks

A similar effect can be achieved using local `graph.stream()` using `astream_events`.

---

## 🎉 Summary

Streaming is the core capability of LangGraph. The key to mastering it is:

1. **Understand different modes**
   - `updates`: status update
   - `values`: Complete status
   - `astream_events`: event streaming (token streaming)
   - `messages`: API exclusive, chat optimization

2. **Choose the right tools**
   - Local development: `astream_events`
   - Production deployment: LangGraph API + `messages` mode

3. **Master asynchronous programming**
   - `async`/`await`
   - `async for`
   - Asynchronous generator

4. **Best Practices**
   - error handling
   - Performance optimization
   - User experience (progress prompts, batch output)

With Streaming, we can build real-time interactive experiences like ChatGPT, which is standard for modern AI applications!

In the next lesson, we will learn **Interruption (human-computer interaction)** to implement advanced functions of pausing during Graph execution and allowing users to confirm or modify it.