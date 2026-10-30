# LangGraph Breakpoints detailed explanation

## 📚 Overview

This document explains in detail the **Breakpoints** mechanism in LangGraph. Breakpoints are the basic tool for implementing **Human-in-the-Loop**, allowing us to pause during Agent execution, obtain user confirmation, and continue execution. This is a key technology for building controllable, trustworthy AI applications.

## 🎯 Core Concept

### What are Breakpoints?

Breakpoints are a mechanism provided by LangGraph that allow you to **actively pause** during the execution of the graph and **wait for manual intervention** before a specific node.

**Core features:**
1. **Pause execution**: Stop the execution of the graph before the specified node
2. **Check Status**: Check the status of the current graph
3. **Human decision-making**: Human beings decide whether to continue execution
4. **Resume execution**: After approval, continue running from the breakpoint

### Three major application scenarios of Human-in-the-Loop

According to the tutorial, Human-in-the-Loop has three main application scenarios:

#### 1. Approval
- **Scenario**: An agent must obtain human approval before performing a sensitive operation.
- **Example**:
  - Confirm before calling payment API
  - Confirm before deleting data
  - Review content before sending emails
  - Perform verification before tool invocation

#### 2. Debugging
- **Scenario**: Replay the execution process of the graph and locate the problem
- **Example**:
  - Check the input and output of a node
  - Analyze the Agent’s decision-making path
  - Reproduce the error scenario

#### 3. Editing
- **Scenario**: Modify status during execution
- **Example**:
  - Correct Agent's misjudgment
  - Adjust tool calling parameters
  - Modify intermediate results

**Focus of this tutorial:** We will focus on the **Approval** scenario and learn how to use Breakpoints to implement tool call approval.

---

## 🎭 Practical case: Math assistant with approval

We will build a mathematical calculation agent that requires user approval before calling any tool.

### System architecture diagram

```
用户输入: "Multiply 2 and 3"
        ↓
   [assistant] 生成工具调用
        ↓
   🛑 BREAKPOINT (interrupt_before=["tools"])
        ↓
   等待用户批准...
        ↓
   用户输入: "yes"
        ↓
   [tools] 执行工具 (multiply)
        ↓
   [assistant] 生成最终答案
        ↓
   输出: "The result is 6"
```

---

## 🔧 Detailed explanation of code implementation

### 1. Define tools and models

```python
from langchain_openai import ChatOpenAI

def multiply(a: int, b: int) -> int:
    """Multiply a and b.

    Args:
        a: first int
        b: second int
    """
    return a * b

def add(a: int, b: int) -> int:
    """Adds a and b.

    Args:
        a: first int
        b: second int
    """
    return a + b

def divide(a: int, b: int) -> float:
    """Divide a by b.

    Args:
        a: first int
        b: second int
    """
    return a / b

tools = [add, multiply, divide]
llm = ChatOpenAI(model="gpt-4o")
llm_with_tools = llm.bind_tools(tools)
```

**Description:**
- Three simple mathematical tools defined
- `llm.bind_tools(tools)` binds the tool to LLM, enabling it to generate tool calls

**Python knowledge point: function documentation string (Docstring)**

```python
def multiply(a: int, b: int) -> int:
    """Multiply a and b.  # ← 简短描述

    Args:              # ← 参数说明
        a: first int
        b: second int
    """
    return a * b
```

In LangChain, this docstring is passed to LLM to help it understand how to use the tool:
- **Description**: Tell LLM what this tool does
- **Parameters**: Explain the meaning and type of each parameter
- **LLM Exploitation**: LLM will use this information to decide when to call the tool and what parameters to pass

---

### 2. Define status

```python
from langgraph.graph import MessagesState
```

**LangGraph knowledge point: MessagesState**

`MessagesState` is LangGraph’s predefined status class, specifically used in chat scenarios:

```python
class MessagesState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
```

**Key Features:**
1. **Automatic message management**: Use `add_messages` reducer to automatically handle message appending
2. **Supports multiple message types**: `HumanMessage`, `AIMessage`, `ToolMessage`, `SystemMessage`
3. **Deduplication and Update**: Automatically remove duplication and update based on message ID

**Equivalent manual definition:**
```python
from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages

class MessagesState(TypedDict):
    messages: Annotated[list, add_messages]
```

---

### 3. Define nodes

```python
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

# System message
sys_msg = SystemMessage(content="You are a helpful assistant tasked with performing arithmetic on a set of inputs.")

# Node
def assistant(state: MessagesState):
    return {"messages": [llm_with_tools.invoke([sys_msg] + state["messages"])]}
```

**Function:**
- Receive current conversation history (`state["messages"]`)
- Add system prompt words
- Call LLM to generate a response (may include tool calls)
- Return new AIMessage

**Python knowledge points: list splicing**

```python
[sys_msg] + state["messages"]
# 相当于：
# [SystemMessage(...), HumanMessage(...), AIMessage(...), ...]
```

This ensures that the system prompt word is always at the beginning of the conversation history.

---

### 4. Build the graph (Core: Add Breakpoint)

```python
from IPython.display import Image, display
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, StateGraph
from langgraph.prebuilt import tools_condition, ToolNode

# Graph
builder = StateGraph(MessagesState)

# Define nodes: these do the work
builder.add_node("assistant", assistant)
builder.add_node("tools", ToolNode(tools))

# Define edges: these determine the control flow
builder.add_edge(START, "assistant")
builder.add_conditional_edges(
    "assistant",
    tools_condition,
)
builder.add_edge("tools", "assistant")

memory = MemorySaver()
graph = builder.compile(interrupt_before=["tools"], checkpointer=memory)
```

**Key point analysis:**

#### (1) interrupt_before=["tools"]

This is the core of implementing Breakpoint!

```python
graph = builder.compile(interrupt_before=["tools"], checkpointer=memory)
#                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^
#                      在 "tools" 节点前中断
```

**Effect:**
- When the graph is executed before the `tools` node, **automatically pauses**
- state is saved to checkpoint
- Wait for the user to call `graph.stream(None, ...)` to continue execution

**Other options:**
```python
# 在节点后中断
interrupt_after=["assistant"]

# 同时使用
interrupt_before=["tools"]
interrupt_after=["assistant"]
```

#### (2) checkpointer=memory

**Why do you need checkpointer? **

Breakpoints rely on state persistence:
- **While paused**: Save current state to checkpoint
- **On recovery**: Load state from checkpoint and continue execution

```python
from langgraph.checkpoint.memory import MemorySaver

memory = MemorySaver()  # 内存存储（开发测试用）
# 生产环境可以使用：
# - PostgresSaver (数据库持久化)
# - RedisSaver (Redis 持久化)
```

#### (3) tools_condition

This is LangGraph’s predefined conditional function:

```python
from langgraph.prebuilt import tools_condition
```

**Function:**
- Check whether the latest AIMessage contains tool calls
- If there is a tool call → route to `tools` node
- If no tool is called → route to `END`

**Equivalent manual implementation:**
```python
def tools_condition(state: MessagesState):
    last_message = state["messages"][-1]
    if isinstance(last_message, AIMessage) and last_message.tool_calls:
        return "tools"
    return END
```

#### (4) ToolNode

This is LangGraph’s predefined tool execution node:

```python
from langgraph.prebuilt import ToolNode

tools_node = ToolNode(tools)
```

**Function:**
- Automate tool calls in AIMessage
- Returns ToolMessage result
-Support parallel tool invocation
- Built-in error handling

---

### 5. First execution: trigger Breakpoint

```python
# Input
initial_input = {"messages": HumanMessage(content="Multiply 2 and 3")}

# Thread
thread = {"configurable": {"thread_id": "1"}}

# Run the graph until the first interruption
for event in graph.stream(initial_input, thread, stream_mode="values"):
    event['messages'][-1].pretty_print()
```

**Output:**
```
================================ Human Message =================================
Multiply 2 and 3

================================== Ai Message ==================================
Tool Calls:
  multiply (call_oFkGpnO8CuwW9A1rk49nqBpY)
 Call ID: call_oFkGpnO8CuwW9A1rk49nqBpY
  Args:
    a: 2
    b: 3
```

**Execution process:**
1. User input "Multiply 2 and 3"
2. `assistant` node generates AIMessage, including `multiply` tool call
3. The graph is ready to enter the `tools` node
4. **Trigger breakpoint**, execution pauses 🛑
5. Return the current status (including the AIMessage called by the tool)

**LangGraph knowledge points: Thread and state isolation**

```python
thread = {"configurable": {"thread_id": "1"}}
```

**The role of Thread:**
- Each `thread_id` corresponds to an independent conversation session
- The status of different threads is completely isolated
- Supports concurrent execution of multiple conversations

**Example:**
```python
# Thread 1
thread1 = {"configurable": {"thread_id": "1"}}
graph.stream({"messages": [HumanMessage("Hi")]}, thread1)

# Thread 2（完全独立）
thread2 = {"configurable": {"thread_id": "2"}}
graph.stream({"messages": [HumanMessage("Hello")]}, thread2)
```

---

### 6. Check status

```python
state = graph.get_state(thread)
print(state.next)
```

**Output:**
```
('tools',)
```

**LangGraph knowledge point: get_state()**

```python
state = graph.get_state(thread)
```

**The returned state object contains:**
- `state.values`: current status data (such as `messages`)
- `state.next`: The next node to be executed (if there is a breakpoint)
- `state.tasks`: tasks to be executed
- `state.config`: Configuration information

**Use:**
- Check if the graph is paused at breakpoint
- View current status
- for debugging and monitoring

---

### 7. Resume execution: continue execution from the breakpoint

```python
for event in graph.stream(None, thread, stream_mode="values"):
    event['messages'][-1].pretty_print()
```

**Core Tip: Pass in `None` as input! **

```python
graph.stream(None, thread, stream_mode="values")
#            ^^^^
#            关键：使用 None
```

**Why use `None`? **

- `None` tells LangGraph: "Don't add new input, continue where you left off"
- The graph will load state from checkpoint
- Continue execution from the node specified by `state.next` (`tools`)

**Output:**
```
================================== Ai Message ==================================
Tool Calls:
  multiply (call_oFkGpnO8CuwW9A1rk49nqBpY)
 Call ID: call_oFkGpnO8CuwW9A1rk49nqBpY
  Args:
    a: 2
    b: 3

================================= Tool Message =================================
Name: multiply

6

================================== Ai Message ==================================
The result of multiplying 2 and 3 is 6.
```

**Execution process:**
1. **Reissue current status**: First return the AIMessage (including tool call) when last paused
2. **Execute tools node**: call `multiply(2, 3)` and return `6`
3. **Return to assistant node**: Generate the final answer
4. **End**: No more tool calls, the process ends

**Important: Why is the AIMessage reissued? **

LangGraph’s design philosophy:
> "When we invoke the graph with `None`, it will re-emit the current state, which contains the `AIMessage` with tool call."

Advantages of doing this:
- **Completeness**: Ensure that users see the complete execution process
- **Transparency**: clearly see where it was recovered from
- **Debug Friendly**: Easy to understand the execution status of the graph

---

### 8. Complete user approval process

```python
# Input
initial_input = {"messages": HumanMessage(content="Multiply 2 and 3")}

# Thread
thread = {"configurable": {"thread_id": "2"}}

# Run the graph until the first interruption
for event in graph.stream(initial_input, thread, stream_mode="values"):
    event['messages'][-1].pretty_print()

# Get user feedback
user_approval = input("Do you want to call the tool? (yes/no): ")

# Check approval
if user_approval.lower() == "yes":
    # If approved, continue the graph execution
    for event in graph.stream(None, thread, stream_mode="values"):
        event['messages'][-1].pretty_print()
else:
    print("Operation cancelled by user.")
```

**Process Summary:**

```
1. 执行图 → 触发 breakpoint
2. 显示工具调用信息
3. 询问用户批准 → input("yes/no")
4. 如果批准 → stream(None, thread) 继续执行
5. 如果拒绝 → 取消操作
```

**Actual output example:**
```
================================ Human Message =================================
Multiply 2 and 3

================================== Ai Message ==================================
Tool Calls:
  multiply (call_tpHvTmsHSjSpYnymzdx553SU)
 Call ID: call_tpHvTmsHSjSpYnymzdx553SU
  Args:
    a: 2
    b: 3

Do you want to call the tool? (yes/no): yes

================================== Ai Message ==================================
Tool Calls:
  multiply (call_tpHvTmsHSjSpYnymzdx553SU)
 Call ID: call_tpHvTmsHSjSpYnymzdx553SU
  Args:
    a: 2
    b: 3

================================= Tool Message =================================
Name: multiply

6

================================== Ai Message ==================================
The result of multiplying 2 and 3 is 6.
```

---

## 🌐 Use LangGraph API to implement Breakpoints

The second part of the tutorial explains how to use Breakpoints in **LangGraph Studio**.

### LangGraph Studio local development server

**Startup method:**

Run in the `/module-3/studio` directory:

```bash
langgraph dev
```

**Output:**
```
- 🚀 API: http://127.0.0.1:2024
- 🎨 Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- 📚 API Docs: http://127.0.0.1:2024/docs
```

**Visit:**
Open `https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024` in your browser

---

### Connect to the API using the SDK

```python
from langgraph_sdk import get_client

client = get_client(url="http://127.0.0.1:2024")
```

**LangGraph SDK knowledge points:**

LangGraph SDK provides a complete API client for:
- **Create threads**: `client.threads.create()`
- **Run Chart**: `client.runs.stream()`
- **GET STATUS**: `client.threads.get_state()`
- **UPDATE STATUS**: `client.threads.update_state()`

---

### API method to execute graph with Breakpoint

```python
initial_input = {"messages": HumanMessage(content="Multiply 2 and 3")}
thread = await client.threads.create()

async for chunk in client.runs.stream(
    thread["thread_id"],
    assistant_id="agent",
    input=initial_input,
    stream_mode="values",
    interrupt_before=["tools"],
):
    print(f"Receiving new event of type: {chunk.event}...")
    messages = chunk.data.get('messages', [])
    if messages:
        print(messages[-1])
    print("-" * 50)
```

**Key Points:**

#### (1) interrupt_before parameter

```python
async for chunk in client.runs.stream(
    thread["thread_id"],
    assistant_id="agent",
    input=initial_input,
    stream_mode="values",
    interrupt_before=["tools"],  # ← 动态指定 breakpoint
):
```

**Comparison of two methods:**

| How | Setting the location | Flexibility |
|------|---------|-------|
| **Compile time** | `graph.compile(interrupt_before=["tools"])` | Fixed, suitable for scenarios where interrupts are always required |
| **Runtime** | `client.runs.stream(..., interrupt_before=["tools"])` | Flexible, can be determined dynamically based on the request |

**Best Practices:**
- **Develop/Test**: Use compile-time settings
- **Production environment**: Use runtime settings to allow different users to have different interrupt strategies

#### (2) async for streaming output

```python
async for chunk in client.runs.stream(...):
    print(chunk)
```

**Python knowledge point: Asynchronous iterator**

- `async for` for asynchronous iteration
- Suitable for processing streaming data (such as LLM output, network requests)
- Difference from `for`: it can wait for data without blocking other operations

**Sync version (if required):**
```python
for chunk in client.runs.stream_sync(...):  # 注意是 stream_sync
    print(chunk)
```

---

### API method to resume execution

```python
async for chunk in client.runs.stream(
    thread["thread_id"],
    "agent",
    input=None,  # ← 关键：使用 None
    stream_mode="values",
    interrupt_before=["tools"],
):
    print(f"Receiving new event of type: {chunk.event}...")
    messages = chunk.data.get('messages', [])
    if messages:
        print(messages[-1])
    print("-" * 50)
```

**Exactly the same as the local version:**
- Use `input=None` to resume from breakpoint
- The graph will continue execution from where it was last paused

---

## 🎓 Summary of core knowledge points

### LangGraph-specific concepts

#### 1. Breakpoints mechanism

**Compile time settings:**
```python
graph.compile(
    interrupt_before=["node1", "node2"],  # 节点前中断
    interrupt_after=["node3"],            # 节点后中断
    checkpointer=memory                    # 必需：状态持久化
)
```

**Runtime Settings:**
```python
client.runs.stream(
    thread_id,
    assistant_id,
    input=data,
    interrupt_before=["node1"]  # 动态设置
)
```

#### 2. Tips for resuming execution

```python
# 关键：使用 None 作为输入
graph.stream(None, thread, stream_mode="values")
```

**Principle:**
- Load state from checkpoint
- Continue from the node specified by `state.next`
- No new input messages are added

#### 3. Status check

```python
state = graph.get_state(thread)

# 检查是否在 breakpoint 处
if state.next:
    print(f"Paused before: {state.next}")

# 查看当前状态
print(state.values)
```

#### 4. Thread and session management

```python
thread = {"configurable": {"thread_id": "unique-id"}}
```

**Best Practices:**
- Use unique `thread_id` per user session
- Generate ID using UUID or timestamp
- Associate `thread_id` and user information in the database

```python
import uuid

# 为每个新会话生成唯一 ID
thread_id = str(uuid.uuid4())
thread = {"configurable": {"thread_id": thread_id}}
```

---

### Python-specific knowledge points

#### 1. Function type annotation

```python
def multiply(a: int, b: int) -> int:
    """..."""
    return a * b
```

**The role of type annotations:**
- **IDE support**: code completion, error checking
- **LangChain tool**: automatically generate tool schema
- **Documentation**: clear interface definition

#### 2. Docstring and tool integration

```python
def multiply(a: int, b: int) -> int:
    """Multiply a and b.  # ← LLM 会读取这个描述

    Args:
        a: first int   # ← LLM 会理解参数含义
        b: second int
    """
    return a * b
```

**How to use LangChain Docstring:**
```python
tools = [multiply]
llm_with_tools = llm.bind_tools(tools)

# LangChain 会自动将 docstring 转换为工具描述：
# {
#   "name": "multiply",
#   "description": "Multiply a and b.",
#   "parameters": {
#     "a": {"type": "integer", "description": "first int"},
#     "b": {"type": "integer", "description": "second int"}
#   }
# }
```

#### 3. List comprehension

```python
[sys_msg] + state["messages"]

# 等价于：
result = [sys_msg]
result.extend(state["messages"])
```

**Purpose:** Quickly build a new list and keep the original list unchanged (immutability)

#### 4. Basics of asynchronous programming

```python
# 异步函数定义
async def my_function():
    result = await some_async_operation()
    return result

# 异步迭代
async for item in async_iterator:
    process(item)

# 运行异步代码
import asyncio
asyncio.run(my_function())
```

**When to use async:**
- API requests (such as LangGraph API)
- Database operations
- I/O intensive tasks
- Need to process multiple tasks concurrently

---

## 💡 Best Practices

### 1. When to use Breakpoints?

✅ **Recommended scenario:**

1. **Sensitive Operation Approval**
   ```python
   # 支付、删除、发送邮件等操作前
   interrupt_before=["payment_tool", "delete_tool", "email_tool"]
   ```

2. **User Confirmation**
   ```python
   # 重要决策前让用户确认
   interrupt_before=["book_flight", "submit_order"]
   ```

3. **Debugging and Development**
   ```python
   # 检查每一步的输出
   interrupt_after=["every", "single", "node"]
   ```

4. **Security Control**
   ```python
   # 防止 Agent 执行危险操作
   interrupt_before=["system_command", "file_operations"]
   ```

❌ **Not recommended scenarios:**

- High-frequency, low-risk operations (will seriously affect user experience)
- Fully automated background tasks
- Scenarios that require real-time response

### 2. Breakpoint location selection

**interrupt_before vs interrupt_after**

| Timing | Applicable scenarios | Examples |
|------|---------|------|
| `interrupt_before` | Approval before execution | Confirm before tool invocation |
| `interrupt_after` | View execution results | Check generated content |

**Example:**

```python
# 场景 1：审批工具调用
interrupt_before=["tools"]  # 在工具执行前中断

# 场景 2：审查生成内容
interrupt_after=["generate_response"]  # 生成后中断，允许编辑

# 场景 3：组合使用
interrupt_before=["risky_operation"]
interrupt_after=["data_processing"]
```

### 3. User experience optimization

#### Tip 1: Provide clear contextual information

```python
for event in graph.stream(initial_input, thread, stream_mode="values"):
    last_msg = event['messages'][-1]

    if isinstance(last_msg, AIMessage) and last_msg.tool_calls:
        # 显示即将执行的工具
        tool = last_msg.tool_calls[0]
        print(f"Agent wants to call: {tool['name']}")
        print(f"With arguments: {tool['args']}")

        # 询问用户
        approval = input("Approve? (yes/no): ")

        if approval.lower() == "yes":
            # 继续执行
            for event in graph.stream(None, thread, stream_mode="values"):
                event['messages'][-1].pretty_print()
        else:
            print("Operation cancelled.")
```

#### Tip 2: Provide approval options

```python
def get_user_approval(tool_call):
    print(f"\nAgent wants to: {tool_call['name']}({tool_call['args']})")
    print("Options:")
    print("  1. Approve")
    print("  2. Reject")
    print("  3. Edit parameters")

    choice = input("Choose (1/2/3): ")

    if choice == "1":
        return "approve"
    elif choice == "2":
        return "reject"
    elif choice == "3":
        return "edit"
    else:
        return "reject"  # 默认拒绝
```

#### Tip 3: Automatically handle timeouts

```python
import signal

def timeout_handler(signum, frame):
    raise TimeoutError("User approval timeout")

def get_approval_with_timeout(timeout=30):
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(timeout)  # 30 秒超时

    try:
        approval = input("Approve? (yes/no): ")
        signal.alarm(0)  # 取消超时
        return approval.lower() == "yes"
    except TimeoutError:
        print("\nTimeout! Auto-rejecting...")
        return False
```

### 4. Error handling

```python
try:
    # 执行图
    for event in graph.stream(initial_input, thread, stream_mode="values"):
        event['messages'][-1].pretty_print()

    # 获取用户批准
    approval = input("Approve? (yes/no): ")

    if approval.lower() == "yes":
        # 继续执行
        for event in graph.stream(None, thread, stream_mode="values"):
            event['messages'][-1].pretty_print()
    else:
        print("Operation cancelled by user.")

except KeyboardInterrupt:
    print("\nInterrupted by user. Cleaning up...")
    # 清理资源

except Exception as e:
    print(f"Error: {e}")
    # 记录错误日志
```

---

## 🚀 Advanced skills

### 1. Conditional Breakpoint

Determine whether to interrupt based on different conditions:

```python
def should_interrupt(state: MessagesState) -> bool:
    """根据状态决定是否需要人工审批"""
    last_msg = state["messages"][-1]

    if isinstance(last_msg, AIMessage) and last_msg.tool_calls:
        tool_name = last_msg.tool_calls[0]['name']

        # 高风险工具需要审批
        high_risk_tools = ["delete", "payment", "send_email"]
        return tool_name in high_risk_tools

    return False

# 在运行时动态决定
if should_interrupt(state):
    # 使用 breakpoint
    graph_with_interrupt = graph.compile(interrupt_before=["tools"], checkpointer=memory)
else:
    # 不使用 breakpoint
    graph_with_interrupt = graph.compile(checkpointer=memory)
```

**Note:** LangGraph itself does not support dynamic conditional breakpoints and needs to be implemented at the application layer.

### 2. Multi-level approval

For key operations, multi-level approval can be achieved:

```python
# Level 1: 自动检查
def auto_check(state):
    """自动安全检查"""
    if not is_safe(state):
        return "reject"
    return "need_human_approval"

# Level 2: 人工审批
def human_approval(state):
    """人工审批"""
    approval = input("Level 1 passed. Final approval? (yes/no): ")
    return approval.lower() == "yes"

# 在图中实现
builder.add_conditional_edges(
    "auto_check",
    auto_check,
    {
        "reject": END,
        "need_human_approval": "human_approval_node"
    }
)
```

### 3. Approval history

Document all approval decisions:

```python
from datetime import datetime

approval_log = []

def log_approval(tool_call, approved, user_id):
    """记录审批历史"""
    approval_log.append({
        "timestamp": datetime.now().isoformat(),
        "tool": tool_call['name'],
        "args": tool_call['args'],
        "approved": approved,
        "user": user_id
    })

# 使用
approval = input("Approve? (yes/no): ")
approved = approval.lower() == "yes"
log_approval(tool_call, approved, user_id="user123")

# 查看历史
for log in approval_log:
    print(f"{log['timestamp']}: {log['tool']} - {'✓' if log['approved'] else '✗'}")
```

### 4. Integrate with UI

Using Breakpoints in web applications:

```python
# FastAPI 示例
from fastapi import FastAPI, WebSocket

app = FastAPI()

@app.websocket("/ws/{thread_id}")
async def websocket_endpoint(websocket: WebSocket, thread_id: str):
    await websocket.accept()

    # 启动图执行
    thread = {"configurable": {"thread_id": thread_id}}

    for event in graph.stream(initial_input, thread, stream_mode="values"):
        # 发送消息到前端
        await websocket.send_json({
            "type": "message",
            "data": event['messages'][-1]
        })

    # 触发 breakpoint，请求批准
    await websocket.send_json({
        "type": "approval_required",
        "tool": tool_call
    })

    # 等待前端响应
    approval = await websocket.receive_json()

    if approval["approved"]:
        # 继续执行
        for event in graph.stream(None, thread, stream_mode="values"):
            await websocket.send_json({
                "type": "message",
                "data": event['messages'][-1]
            })
```

---

## 🎯 Practical application cases

### Case 1: Intelligent customer service work order system

**Requirements:** Agent can query and create work orders, but submitting work orders requires manual confirmation.

```python
# 工具定义
def query_ticket(ticket_id: str) -> dict:
    """查询工单信息（低风险，无需审批）"""
    return {"ticket_id": ticket_id, "status": "open"}

def create_ticket(title: str, description: str) -> dict:
    """创建工单（高风险，需要审批）"""
    return {"ticket_id": "T123", "title": title}

tools = [query_ticket, create_ticket]

# 只对 create_ticket 设置 breakpoint
# 实现方式：使用自定义节点
def tools_with_approval(state: MessagesState):
    """带审批的工具节点"""
    tool_call = state["messages"][-1].tool_calls[0]

    # 高风险工具需要审批
    if tool_call['name'] == 'create_ticket':
        # 触发 breakpoint 逻辑
        return {"needs_approval": True}
    else:
        # 直接执行
        result = execute_tool(tool_call)
        return {"messages": [ToolMessage(content=result, tool_call_id=tool_call['id'])]}
```

### Case 2: Code Deployment Assistant

**Requirements:** Agent can check code and run tests, but deployment to production environment requires manual approval.

```python
# 构建图
builder = StateGraph(MessagesState)
builder.add_node("assistant", assistant)
builder.add_node("run_tests", run_tests_node)
builder.add_node("deploy", deploy_node)  # 部署节点

# 只在部署前中断
graph = builder.compile(
    interrupt_before=["deploy"],  # 只在部署前需要批准
    checkpointer=memory
)

# 执行
for event in graph.stream({"messages": [HumanMessage("Deploy to production")]}, thread):
    print(event)

# 检查即将部署的版本
state = graph.get_state(thread)
print(f"About to deploy version: {state.values['version']}")

# 获取批准
approval = input("Deploy to production? (yes/no): ")
if approval.lower() == "yes":
    for event in graph.stream(None, thread):
        print(event)
```

### Case 3: Data Analysis Assistant

**Requirements:** Agent can query data and generate reports, but deleting data requires manual confirmation.

```python
def analyze_data(query: str) -> str:
    """分析数据（安全操作）"""
    return "Analysis result..."

def delete_data(table: str, condition: str) -> str:
    """删除数据（危险操作）"""
    return f"Deleted rows from {table}"

# 使用 interrupt_before
graph = builder.compile(
    interrupt_before=["delete_data_node"],
    checkpointer=memory
)

# 执行时
for event in graph.stream(initial_input, thread):
    last_msg = event['messages'][-1]

    if isinstance(last_msg, AIMessage) and last_msg.tool_calls:
        tool = last_msg.tool_calls[0]

        if tool['name'] == 'delete_data':
            # 显示即将删除的数据
            print(f"⚠️  WARNING: About to delete data!")
            print(f"   Table: {tool['args']['table']}")
            print(f"   Condition: {tool['args']['condition']}")

            # 需要输入确认文本
            confirmation = input("Type 'DELETE' to confirm: ")

            if confirmation == "DELETE":
                for event in graph.stream(None, thread):
                    print(event)
            else:
                print("Operation cancelled.")
```

---

## 📊 Breakpoints vs other control mechanisms

### Comparison table

| Features | Breakpoints | Conditional Edges | Artificial Nodes |
|------|------------|--------|---------|
| **Pause execution** | ✅ Automatic | ❌ Do not pause | ✅ Manual |
| **Continue execution** | `stream(None)` | Automatic transfer | Explicit call |
| **User Interaction** | Outside the graph | Inside the graph | Inside the node |
| **Flexibility** | High | Medium | Low |
| **Complexity** | Low | Medium | High |
| **Applicable scenarios** | Tool approval and debugging | Routing decisions | Complex interactions |

### Usage suggestions

**Use Breakpoints:**
```python
# 简单的批准/拒绝场景
graph.compile(interrupt_before=["tools"], checkpointer=memory)
```

**Use conditional edges:**
```python
# 基于状态的自动路由
def should_continue(state):
    if state["ready"]:
        return "continue"
    return "wait"

builder.add_conditional_edges("check", should_continue, {"continue": "next", "wait": END})
```

**Use artificial nodes:**
```python
# 需要在图内部处理用户输入
def human_input_node(state):
    user_input = get_user_input()  # 自定义输入逻辑
    return {"user_feedback": user_input}

builder.add_node("human_input", human_input_node)
```

---

## 🔍 Frequently Asked Questions

### Q1: After Breakpoint is triggered, can the execution be canceled?

**Yes! ** Just don't call `stream(None)`:

```python
# 触发 breakpoint
for event in graph.stream(initial_input, thread):
    print(event)

# 获取批准
approval = input("Continue? (yes/no): ")

if approval.lower() == "yes":
    # 继续执行
    for event in graph.stream(None, thread):
        print(event)
else:
    # 不调用 stream(None)，执行就停止了
    print("Execution cancelled.")
```

**Status:** The state of the graph is still saved in the checkpoint and can be restored later.

### Q2: Can I modify the status and then continue execution?

**Can! ** Using `update_state()`:

```python
# 触发 breakpoint
for event in graph.stream(initial_input, thread):
    print(event)

# 修改状态（例如，修改工具参数）
state = graph.get_state(thread)
modified_messages = state.values["messages"].copy()

# 修改最后一条 AIMessage 的工具调用参数
last_msg = modified_messages[-1]
last_msg.tool_calls[0]['args']['a'] = 10  # 修改参数

# 更新状态
graph.update_state(thread, {"messages": modified_messages})

# 继续执行（使用修改后的状态）
for event in graph.stream(None, thread):
    print(event)
```

**Note:** This is the **Editing** scenario, which will be explained in detail in subsequent tutorials.

### Q3: Can multiple Breakpoints be set in the same graph?

**Can! **

```python
graph = builder.compile(
    interrupt_before=["tools", "generate_report", "send_email"],
    checkpointer=memory
)
```

**Execution process:**
- Each time these nodes are encountered, a breakpoint will be triggered
- Multiple calls to `stream(None)` are required to complete the entire process

**Example:**
```python
# 第一个 breakpoint（tools 前）
for event in graph.stream(initial_input, thread):
    print(event)

approval1 = input("Approve tool call? (yes/no): ")
if approval1.lower() == "yes":
    # 第二个 breakpoint（generate_report 前）
    for event in graph.stream(None, thread):
        print(event)

    approval2 = input("Approve report generation? (yes/no): ")
    if approval2.lower() == "yes":
        # 继续执行
        for event in graph.stream(None, thread):
            print(event)
```

### Q4: Are Breakpoint and streaming compatible?

**Fully compatible! **

```python
# 流式输出 + Breakpoint
for event in graph.stream(initial_input, thread, stream_mode="values"):
    # 实时显示每一步的输出
    event['messages'][-1].pretty_print()

# 触发 breakpoint 后，继续流式输出
for event in graph.stream(None, thread, stream_mode="values"):
    event['messages'][-1].pretty_print()
```

### Q5: How to use Breakpoints in a production environment?

**Recommended architecture:**

```
用户请求
   ↓
Web Server (FastAPI/Flask)
   ↓
LangGraph (with breakpoint)
   ↓
触发 breakpoint
   ↓
保存状态到数据库
   ↓
返回审批请求给用户
   ↓
用户批准
   ↓
从数据库加载状态
   ↓
继续执行 (stream with None)
   ↓
返回结果
```

**Key Points:**
1. **Asynchronous processing**: Don’t block web requests
2. **Persistence**: Use database checkpoint (PostgreSQL, Redis)
3. **Notification mechanism**: Notify users through WebSocket or polling
4. **Timeout processing**: Set approval timeout to automatically reject

**Sample code:**
```python
from langgraph.checkpoint.postgres import PostgresSaver

# 使用 PostgreSQL 持久化
checkpointer = PostgresSaver(connection_string="postgresql://...")

graph = builder.compile(
    interrupt_before=["tools"],
    checkpointer=checkpointer  # 生产级持久化
)

# 异步执行
@app.post("/execute")
async def execute_graph(request: Request):
    thread_id = str(uuid.uuid4())
    thread = {"configurable": {"thread_id": thread_id}}

    # 后台执行
    asyncio.create_task(run_graph(thread))

    # 立即返回 thread_id
    return {"thread_id": thread_id, "status": "started"}

@app.post("/approve/{thread_id}")
async def approve(thread_id: str):
    thread = {"configurable": {"thread_id": thread_id}}

    # 继续执行
    for event in graph.stream(None, thread):
        # 处理结果
        pass

    return {"status": "completed"}
```

---

## 📖 Further reading

- [LangGraph Breakpoints official document](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/breakpoints/)
- [LangGraph Human-in-the-Loop Guide](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/)
- [LangGraph Checkpointing](https://langchain-ai.github.io/langgraph/concepts/persistence/)
- [LangGraph Studio Documentation](https://langchain-ai.github.io/langgraph/concepts/langgraph_studio/)

---

## 🎉 Summary

Breakpoints is the basic tool for LangGraph to implement Human-in-the-Loop:

1. **Easy to use**: Just add the `interrupt_before/after` parameter when `compile()`
2. **Flexible control**: Breakpoint can be set at compile time or run time
3. **Seamless Recovery**: Easily resume execution with `stream(None)`
4. **State persistence**: relies on checkpointer to support long-term asynchronous approval

**Core skills:**
- `interrupt_before=["node"]` pauses before node
- `stream(None, thread)` Continue from breakpoint
- `get_state(thread)` Check pause status
- Cooperate with checkpointer to implement production-level applications

With Breakpoints, we can build **controllable, trustworthy, and safe** AI applications, ensuring that critical operations are always performed under human supervision!
