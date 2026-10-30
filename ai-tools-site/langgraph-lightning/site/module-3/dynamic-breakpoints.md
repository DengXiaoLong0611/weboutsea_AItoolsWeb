# LangGraph Dynamic Breakpoints Detailed interpretation

## 📚 Overview

This document explains in detail the **Dynamic Breakpoints** function in LangGraph. This is an advanced human-in-the-Loop technology that allows graphs to automatically break based on specific conditions at runtime, instead of developers setting fixed breakpoints on nodes in advance.

## 🎯 Core Concept

### What are Dynamic Breakpoints?

Dynamic Breakpoints (dynamic breakpoints) are an **internal break mechanism** provided by LangGraph, which is different from traditional static breakpoints:

| Features | Static breakpoints | Dynamic breakpoints |
|------|---------|---------|
| **Setting Timing** | Preset when graph is compiled | Triggered based on conditions during runtime |
| **Trigger method** | Fixed at a specific node | Determined by the internal logic of the node |
| **Flexibility** | Interrupts every time execution | Can be interrupted conditionally |
| **Information Delivery** | Unable to deliver interruption reason | Can deliver detailed information |

### Why do you need Dynamic Breakpoints?

Review the three major application scenarios of human-computer interaction:

1. **Approval** - Wait for the user to approve an action after an interruption
2. **Debugging** - Backtrace the execution process of the graph to reproduce or avoid problems
3. **Editing** - Modify state and inject human feedback

Dynamic Breakpoints are particularly suitable for the following scenarios:

✅ **Conditional interruption**: Only interrupt when specific conditions are met (such as input too long, sensitive content detected, risk score too high)

✅ **Information Delivery**: Tell the user why it was interrupted (such as "Input exceeds character limit", "Unsafe content detected")

✅ **Intelligent Control**: Dynamically decide whether manual intervention is required based on business logic

---

## 🎭 Practical case: condition length checking system

We will build a simple three-step process that automatically breaks when input is longer than 5 characters and requires human review.

### System requirements

**Process:**
1. **Step 1**: Receive and process input
2. **Step 2**: Check the input length and interrupt if it exceeds 5 characters.
3. **Step 3**: Continue processing (only executed after passing Step 2)

### System architecture diagram

```
用户输入
   ↓
[step_1] 处理输入
   ↓
[step_2] 检查长度
   ↓ (len > 5 ?)
   ├─ Yes → 抛出 NodeInterrupt (中断并传递原因)
   ├─ No  → 继续
   ↓
[step_3] 最终处理
   ↓
  END
```

---

## 🔧 Detailed explanation of code implementation

### 1. Import dependencies

```python
from IPython.display import Image, display
from typing_extensions import TypedDict
from langgraph.checkpoint.memory import MemorySaver
from langgraph.errors import NodeInterrupt  # ⭐ 核心：动态中断
from langgraph.graph import START, END, StateGraph
```

**Key Import:**
- `NodeInterrupt`: This is the core class to implement dynamic breakpoints
- `MemorySaver`: used to save state and support recovery after interruption

---

### 2. Define status

```python
class State(TypedDict):
    input: str  # 简单状态：只包含输入字符串
```

**Description:**
- This is a minimalist state definition containing only user input
- Actual applications can include more fields (such as processing results, metadata, etc.)

---

### 3. Implement three processing nodes

#### Step 1: Initial processing

```python
def step_1(state: State) -> State:
    print("---Step 1---")
    return state  # 直接返回状态，不做修改
```

**Function:** This is the first processing step, here it is just a simple log output.

---

#### Step 2: Conditional checking and dynamic interrupt ⭐

```python
def step_2(state: State) -> State:
    # 检查输入长度
    if len(state['input']) > 5:
        # 抛出 NodeInterrupt，传递中断原因
        raise NodeInterrupt(f"Received input that is longer than 5 characters: {state['input']}")

    print("---Step 2---")
    return state
```

**Detailed explanation of core mechanism:**

```python
raise NodeInterrupt(message)
#     ^^^^^^^^^^^^^ ^^^^^^^
#     动态中断类     中断信息（传递给用户）
```

**Key Points:**
1. **Conditional judgment**: `len(state['input']) > 5` - only interrupt when the conditions are met
2. **Exception thrown**: Use `raise NodeInterrupt` to trigger an interrupt
3. **Transfer information**: The string parameters will be recorded in the status, and the user can see the reason for the interruption.
4. **Execution Stop**: Once thrown, the subsequent code of the node will not be executed and the graph will be paused immediately.

**Relationship to Python exception handling:**

`NodeInterrupt` is a special exception class, but it is not used to handle errors, but to intentionally pause execution:

```python
# 普通异常 - 表示错误
try:
    result = risky_operation()
except Exception as e:
    handle_error(e)

# NodeInterrupt - 表示需要人工介入
if needs_human_review(data):
    raise NodeInterrupt("需要人工审核")  # 不需要 try-except
```

---

#### Step 3: Final processing

```python
def step_3(state: State) -> State:
    print("---Step 3---")
    return state
```

**Function:** This step will be executed only after passing the check of Step 2.

---

### 4. Build the graph

```python
builder = StateGraph(State)

# 添加三个节点
builder.add_node("step_1", step_1)
builder.add_node("step_2", step_2)
builder.add_node("step_3", step_3)

# 添加边：定义执行顺序
builder.add_edge(START, "step_1")
builder.add_edge("step_1", "step_2")
builder.add_edge("step_2", "step_3")
builder.add_edge("step_3", END)

# 设置内存检查点（必需！）
memory = MemorySaver()

# 编译图
graph = builder.compile(checkpointer=memory)
```

**Important reminder:**
- `checkpointer=memory` is **required**!
- Without checkpointer, graph cannot be restored after interruption
- Memory Saver saves a state snapshot after each node

---

### 5. Execution graph: trigger dynamic interrupt

```python
initial_input = {"input": "hello world"}  # 11 个字符，超过 5
thread_config = {"configurable": {"thread_id": "1"}}

# 运行图
for event in graph.stream(initial_input, thread_config, stream_mode="values"):
    print(event)
```

**Output:**
```
{'input': 'hello world'}
---Step 1---
{'input': 'hello world'}
```

**Analysis:**
1. The graph starts executing and the status is `{"input": "hello world"}`
2. `step_1` executes and outputs logs
3. `step_2` starts execution, detects that the length exceeds 5, and throws `NodeInterrupt`
4. **The picture is paused immediately** and `step_3` will not be executed.

---

### 6. Check interrupt status

#### View the next node to be executed

```python
state = graph.get_state(thread_config)
print(state.next)
```

**Output:**
```
('step_2',)
```

**Description:**
- `state.next` shows that the next node to be executed is `step_2`
- Because `step_2` is interrupted, it will be re-executed (unless the status is modified)

---

#### View interruption information

```python
print(state.tasks)
```

**Output:**
```python
(PregelTask(
    id='6eb3910d-e231-5ba2-b25e-28ad575690bd',
    name='step_2',
    error=None,
    interrupts=(
        Interrupt(
            value='Received input that is longer than 5 characters: hello world',
            when='during'
        ),
    ),
    state=None
),)
```

**Interpretation of key information:**

| Field | Value | Description |
|------|-----|------|
| `name` | `'step_2'` | Which node did the interrupt occur |
| `error` | `None` | This is not an error, so None |
| `interrupts` | `Interrupt(...)` | Interrupt details |
| `value` | `'Received input...'` | The interrupt reason we passed |
| `when` | `'during'` | The interrupt occurred during node execution** |

**`when` field description:**
- `'during'`: The break occurs inside the node (dynamic breakpoint)
- `'before'`: Break occurs before node (static breakpoint)

---

### 7. Try to resume execution (failure case)

```python
# 尝试继续执行
for event in graph.stream(None, thread_config, stream_mode="values"):
    print(event)
```

**Output:**
```
{'input': 'hello world'}
```

**Check status again:**
```python
state = graph.get_state(thread_config)
print(state.next)
```

**Output:**
```
('step_2',)
```

**Problem Analysis:**
- Calling `graph.stream(None, ...)` will re-execute `step_2`
- But the status has not changed, `input` is still `"hello world"`
- So `NodeInterrupt` is triggered again, stuck in a loop!

**Lesson:** The state must be modified to pass the break point.

---

### 8. Modify status and resume execution (successful case)

#### Update status

```python
graph.update_state(
    thread_config,
    {"input": "hi"},  # 修改输入为短字符串（2 个字符）
)
```

**Output:**
```python
{
    'configurable': {
        'thread_id': '1',
        'checkpoint_ns': '',
        'checkpoint_id': '1ef6a434-06cf-6f1e-8002-0ea6dc69e075'
    }
}
```

**Description:**
- `update_state` will modify the current status
- What is returned is the new checkpoint ID
- The new state will be used the next time it is executed

---

#### Continue execution

```python
for event in graph.stream(None, thread_config, stream_mode="values"):
    print(event)
```

**Output:**
```
{'input': 'hi'}
---Step 2---
{'input': 'hi'}
---Step 3---
{'input': 'hi'}
```

**success! Analysis: **
1. Restart execution from `step_2`
2. At this time `state['input']` is `"hi"` (2 characters)
3. The length check passes and `NodeInterrupt` will not be thrown.
4. Continue to execute `step_3` to complete the entire process

---

## 🎓 Summary of core knowledge points

### LangGraph-specific concepts

#### 1. NodeInterrupt class

**Syntax:**
```python
from langgraph.errors import NodeInterrupt

raise NodeInterrupt(message: str)
```

**Features:**
- Can be thrown **anywhere** inside the node
- A string parameter must be passed (interruption reason)
- Will stop node execution immediately
- Interrupt information will be saved to `state.tasks[].interrupts`

**Comparison with static breakpoints:**

```python
# 静态断点 - 在编译时设置
graph = builder.compile(
    checkpointer=memory,
    interrupt_before=["step_2"]  # 总是在 step_2 之前中断
)

# 动态断点 - 在运行时触发
def step_2(state):
    if some_condition(state):
        raise NodeInterrupt("条件满足，需要人工审核")  # 条件性中断
    return state
```

---

#### 2. Status management after interruption

##### state.next

Display the next node to be executed:

```python
state = graph.get_state(thread_config)
print(state.next)  # ('step_2',)
```

##### state.tasks

Contains details of all pending tasks:

```python
state.tasks[0].name        # 节点名称
state.tasks[0].interrupts  # 中断信息列表
state.tasks[0].error       # 错误信息（如果有）
```

---

#### 3. State recovery process

```
1. 中断发生
   ↓
2. 调用 get_state() 检查状态
   ↓
3. 调用 update_state() 修改状态
   ↓
4. 调用 stream(None, ...) 继续执行
   ↓
5. 从中断点重新开始
```

**Key details:**
- `None` in `stream(None, ...)` means **do not provide new input**, use the current state
- If the status is not modified, the same logic will be re-executed (possibly interrupted again)

---

### Python-specific knowledge points

#### 1. TypedDict basics

```python
from typing_extensions import TypedDict

class State(TypedDict):
    input: str
```

**Function:**
- Define the structure and type of the dictionary
- Provide IDE auto-completion and type checking
- Used by LangGraph to verify state

**Usage example:**
```python
# 创建状态
state: State = {"input": "hello"}

# 类型检查会捕获错误
state = {"input": 123}  # ❌ 错误：应该是 str
state = {"output": "hi"}  # ❌ 错误：缺少 'input' 键
```

---

#### 2. Python exception mechanism

Although `NodeInterrupt` is an exception, it does not require manual catching in LangGraph:

```python
# ✅ 正确用法
def step_2(state):
    if condition:
        raise NodeInterrupt("reason")  # LangGraph 会自动处理
    return state

# ❌ 不需要这样做
def step_2(state):
    try:
        if condition:
            raise NodeInterrupt("reason")
    except NodeInterrupt as e:
        # 不需要捕获！LangGraph 会自动处理
        pass
```

**Principle:** LangGraph's execution engine captures `NodeInterrupt`, saves the state, and then gracefully pauses execution.

---

#### 3. String formatting (f-string)

```python
raise NodeInterrupt(f"Received input that is longer than 5 characters: {state['input']}")
```

**f-string syntax:**
- String starting with `f`
- Use `{}` to insert variables or expressions
- Automatic calculation and formatting at runtime

**Equivalent writing:**
```python
# f-string (推荐)
message = f"Input: {state['input']}, Length: {len(state['input'])}"

# .format() (传统)
message = "Input: {}, Length: {}".format(state['input'], len(state['input']))

# % 格式化 (老式)
message = "Input: %s, Length: %d" % (state['input'], len(state['input']))
```

---

## 💡 Best Practices

### 1. When to use dynamic breakpoints?

✅ **Applicable scenarios:**
- **Content Review**: Interrupt when detecting sensitive words and illegal content
- **Risk Assessment**: Manual review is required when the risk score exceeds the threshold
- **Resource Limitation**: Interrupt when the input is too large or there are too many requests.
- **User Confirmation**: It is necessary to decide whether user confirmation is required based on AI judgment.
- **DEBUG MODE**: Dynamically break based on log level while developing

❌ **Not applicable scenarios:**
- Nodes that always need to be broken (easier with static breakpoints)
- Flow control between nodes (using conditional edges)
- Error handling (using try-except)

---

### 2. Information transmission skills of dynamic breakpoints

#### Tip 1: Structure information

```python
import json

def check_content(state):
    risk_score = calculate_risk(state['input'])

    if risk_score > 0.8:
        # 传递 JSON 格式的详细信息
        info = {
            "reason": "高风险内容",
            "risk_score": risk_score,
            "detected_issues": ["暴力", "敏感词"],
            "suggestion": "建议人工审核或拒绝"
        }
        raise NodeInterrupt(json.dumps(info, ensure_ascii=False))

    return state
```

**Client analysis:**
```python
state = graph.get_state(thread_config)
interrupt_value = state.tasks[0].interrupts[0].value
info = json.loads(interrupt_value)
print(f"风险评分: {info['risk_score']}")
print(f"建议: {info['suggestion']}")
```

---

#### Tip 2: Multiple condition checks

```python
def validate_input(state):
    errors = []

    # 检查 1：长度
    if len(state['input']) > 1000:
        errors.append("输入超过 1000 字符")

    # 检查 2：格式
    if not is_valid_format(state['input']):
        errors.append("格式不符合要求")

    # 检查 3：内容
    if contains_profanity(state['input']):
        errors.append("包含不当内容")

    if errors:
        raise NodeInterrupt(f"验证失败: {', '.join(errors)}")

    return state
```

---

#### Tip 3: Provide fix suggestions

```python
def check_data(state):
    data = state['data']

    if missing_fields := [f for f in required_fields if f not in data]:
        suggestion = f"请补充以下字段: {', '.join(missing_fields)}"
        raise NodeInterrupt(f"数据不完整。{suggestion}")

    return state
```

---

### 3. Status modification strategy

#### Strategy 1: Minimum modification principle

Modify only the necessary fields and retain other information:

```python
# ✅ 好的做法 - 只修改需要的字段
graph.update_state(thread_config, {"input": "hi"})

# ❌ 避免 - 覆盖整个状态（可能丢失其他信息）
graph.update_state(thread_config, {"input": "hi", "other_field": None})
```

---

#### Strategy 2: Keep History

```python
class State(TypedDict):
    input: str
    original_input: str  # 保留原始输入
    modification_history: list  # 记录修改历史

def step_2(state):
    if len(state['input']) > 5:
        raise NodeInterrupt(f"输入过长: {state['input']}")
    return state

# 修改时保留历史
state = graph.get_state(thread_config)
original = state.values['input']
graph.update_state(thread_config, {
    "input": "hi",
    "original_input": original,
    "modification_history": [{"from": original, "to": "hi", "reason": "长度超限"}]
})
```

---

#### Strategy 3: Conditional modification

```python
# 根据中断原因决定如何修改
state = graph.get_state(thread_config)
interrupt_msg = state.tasks[0].interrupts[0].value

if "长度" in interrupt_msg:
    # 截断输入
    graph.update_state(thread_config, {"input": original[:5]})
elif "格式" in interrupt_msg:
    # 修正格式
    graph.update_state(thread_config, {"input": fix_format(original)})
```

---

### 4. Integrate with LangGraph API/Studio

In real applications, you usually interact with graphs through APIs. Here is the complete workflow:

#### Connect to LangGraph service

```python
from langgraph_sdk import get_client

# 连接到本地开发服务器
URL = "http://127.0.0.1:2024"
client = get_client(url=URL)

# 搜索可用的图
assistants = await client.assistants.search()
```

---

#### Create thread and execute

```python
# 创建新线程
thread = await client.threads.create()

# 执行图
async for chunk in client.runs.stream(
    thread["thread_id"],
    assistant_id="dynamic_breakpoints",
    input={"input": "hello world"},
    stream_mode="values"
):
    print(f"Event type: {chunk.event}")
    print(chunk.data)
```

**Example output:**
```
Event type: metadata
{'run_id': '1ef6a43a-1b04-64d0-9a79-1caff72c8a89'}

Event type: values
{'input': 'hello world'}

Event type: values
{'input': 'hello world'}
```

---

#### Check interrupt status

```python
# 获取当前状态
current_state = await client.threads.get_state(thread['thread_id'])

print(current_state['next'])  # ['step_2']
print(current_state['tasks'][0]['interrupts'])  # 中断详情
```

---

#### Update status and restore

```python
# 更新状态
await client.threads.update_state(
    thread['thread_id'],
    {"input": "hi!"}
)

# 继续执行（传入 None）
async for chunk in client.runs.stream(
    thread["thread_id"],
    assistant_id="dynamic_breakpoints",
    input=None,  # ⭐ None 表示使用当前状态
    stream_mode="values"
):
    print(chunk.data)
```

**Output:**
```
{'input': 'hi!'}
---Step 2---
{'input': 'hi!'}
---Step 3---
{'input': 'hi!'}
```

---

## 🚀 Advanced skills

### 1. Multi-level interrupt conditions

```python
def advanced_check(state):
    input_text = state['input']

    # 第一级：严重问题 - 立即拒绝
    if contains_illegal_content(input_text):
        raise NodeInterrupt(
            "严重违规：检测到非法内容，已自动拒绝。"
        )

    # 第二级：中等风险 - 需要审核
    risk = calculate_risk(input_text)
    if risk > 0.7:
        raise NodeInterrupt(
            f"中等风险 (评分: {risk})：建议人工审核。"
        )

    # 第三级：轻微问题 - 警告但继续
    if risk > 0.4:
        print(f"⚠️ 警告：检测到轻微风险 (评分: {risk})")

    return state
```

---

### 2. Interrupt with timeout

```python
from datetime import datetime, timedelta

class State(TypedDict):
    input: str
    interrupt_timestamp: str
    max_wait_seconds: int

def timed_check(state):
    if needs_approval(state['input']):
        timestamp = datetime.now().isoformat()
        raise NodeInterrupt(
            f"需要审批。超时时间：{state.get('max_wait_seconds', 3600)} 秒"
        )
    return state

# 恢复时检查超时
state = graph.get_state(thread_config)
if state.tasks and state.tasks[0].interrupts:
    interrupt_time = datetime.fromisoformat(state.values['interrupt_timestamp'])
    if datetime.now() - interrupt_time > timedelta(seconds=state.values['max_wait_seconds']):
        # 超时处理：自动拒绝或使用默认值
        graph.update_state(thread_config, {"input": "TIMEOUT_REJECTED"})
```

---

### 3. Multipathing after interruption

```python
class State(TypedDict):
    input: str
    approval_decision: str  # "approve", "reject", "modify"

def check_content(state):
    if needs_review(state['input']):
        raise NodeInterrupt("内容需要审核，请选择操作")
    return state

def handle_decision(state):
    decision = state.get('approval_decision', 'reject')

    if decision == 'approve':
        return {"status": "approved"}
    elif decision == 'modify':
        return {"input": state.get('modified_input', state['input'])}
    else:
        return {"status": "rejected"}

# 用户决策后更新
graph.update_state(thread_config, {
    "approval_decision": "modify",
    "modified_input": "修改后的内容"
})
```

---

### 4. Combine static and dynamic breakpoints

```python
# 编译时设置静态断点
graph = builder.compile(
    checkpointer=memory,
    interrupt_before=["final_step"]  # 总是在最后一步前中断
)

# 节点中使用动态断点
def middle_step(state):
    if high_risk(state['data']):
        raise NodeInterrupt("检测到高风险，需要额外审核")  # 动态中断
    return state
```

**Combo effect:**
- `middle_step`: only interrupt at high risk
- `final_step`: always breaks (final acknowledgment)

---

## 📊 Static vs dynamic breakpoint comparison

| Features | Static breakpoints | Dynamic breakpoints |
|------|---------|---------|
| **Setting method** | `interrupt_before=["node"]` | `raise NodeInterrupt()` |
| **Interruption timing** | Before node execution | While node is executing |
| **Trigger Condition** | Always trigger | Based on logical conditions |
| **Information Delivery** | None | Detailed information can be passed |
| **Flexibility** | Low (fixed nodes) | High (dynamically determined) |
| **Applicable scenarios** | Fixed approval point | Conditional review |

**Practical application suggestions:**

```python
# 静态断点 - 用于固定流程
interrupt_before=["deploy", "payment"]  # 总是需要确认的步骤

# 动态断点 - 用于智能判断
def content_filter(state):
    if ai_detects_issue(state['content']):  # AI 判断
        raise NodeInterrupt("AI 检测到潜在问题")
    return state
```

---

## 🎯 Practical application cases

### Case 1: Content review system

```python
class ContentState(TypedDict):
    content: str
    category: str
    risk_score: float

def content_moderation(state: ContentState):
    # 使用 AI 模型评估内容
    result = moderation_model.analyze(state['content'])
    state['risk_score'] = result.risk_score

    # 高风险：立即拒绝
    if result.risk_score > 0.9:
        raise NodeInterrupt(
            f"高风险内容 (评分: {result.risk_score})，已自动拒绝。"
            f"检测到的问题: {', '.join(result.issues)}"
        )

    # 中风险：人工审核
    if result.risk_score > 0.5:
        raise NodeInterrupt(
            f"中风险内容 (评分: {result.risk_score})，需要人工审核。"
            f"可疑点: {', '.join(result.warnings)}"
        )

    # 低风险：自动通过
    return state

# 人工审核后的处理
def handle_review(state):
    decision = state.get('review_decision')
    if decision == 'approve':
        return {"status": "approved"}
    elif decision == 'reject':
        return {"status": "rejected"}
    else:
        return {"status": "needs_modification"}
```

---

### Case 2: Financial transaction approval

```python
class TransactionState(TypedDict):
    amount: float
    account: str
    risk_factors: list
    approval_required: bool

def transaction_check(state: TransactionState):
    amount = state['amount']

    # 规则 1：大额交易
    if amount > 10000:
        raise NodeInterrupt(
            f"大额交易需审批：金额 ${amount:,.2f} 超过限额 $10,000"
        )

    # 规则 2：异常模式
    if detect_anomaly(state['account']):
        risk_factors = analyze_risk(state)
        raise NodeInterrupt(
            f"检测到异常交易模式。风险因素: {', '.join(risk_factors)}"
        )

    # 规则 3：新账户
    if is_new_account(state['account']):
        raise NodeInterrupt(
            f"新账户首次大额交易，需要身份验证"
        )

    return state
```

---

### Case 3: Confirmation of sensitive operations by AI assistant

```python
class AssistantState(TypedDict):
    user_request: str
    planned_action: str
    destructive: bool

def plan_execution(state: AssistantState):
    action = parse_action(state['user_request'])
    state['planned_action'] = action

    # 检测破坏性操作
    destructive_keywords = ['delete', 'remove', 'drop', 'truncate']
    if any(kw in action.lower() for kw in destructive_keywords):
        state['destructive'] = True
        raise NodeInterrupt(
            f"⚠️ 检测到潜在破坏性操作: {action}\n"
            f"此操作可能无法撤销，需要您的明确确认。"
        )

    return state

# 用户确认后继续
graph.update_state(thread_config, {"user_confirmed": True})
```

---

### Case 4: Multi-step verification process

```python
class VerificationState(TypedDict):
    user_id: str
    verification_steps: list
    current_step: int

def verification_flow(state: VerificationState):
    steps = ['identity', 'email', 'phone', 'document']
    current = state['current_step']

    if current < len(steps):
        step_name = steps[current]
        raise NodeInterrupt(
            f"验证步骤 {current + 1}/{len(steps)}: 请完成{step_name}验证"
        )

    return {"verification_complete": True}

# 用户完成每一步后更新
for step in range(4):
    # 用户完成验证
    user_completes_verification(step)

    # 更新状态
    graph.update_state(thread_config, {"current_step": step + 1})

    # 继续执行
    graph.stream(None, thread_config)
```

---

## 🔍 Frequently Asked Questions

### Q1: What is the difference between NodeInterrupt and ordinary Python exceptions?

**Common exception:** Indicates an error and needs to be caught and handled
```python
try:
    result = risky_operation()
except ValueError as e:
    handle_error(e)  # 错误处理逻辑
```

**NodeInterrupt:** Indicates the need to pause, which is automatically handled by LangGraph
```python
if needs_human_review(data):
    raise NodeInterrupt("需要人工审核")  # 不需要 try-except
```

**Key differences:**
- Ordinary exceptions interrupt program execution (unless caught)
- NodeInterrupt will pause graph execution, but can be resumed
- Ordinary exception means "something went wrong", NodeInterrupt means "need to wait"

---

### Q2: Why must I use MemorySaver?

Because dynamic breakpoints require:
1. **Save the status at the time of interruption**
2. **Record the reason for the interruption**
3. **Support status recovery**

Without checkpointers, the graph cannot save this information:

```python
# ❌ 错误 - 无法使用动态断点
graph = builder.compile()  # 没有 checkpointer

# ✅ 正确
memory = MemorySaver()
graph = builder.compile(checkpointer=memory)
```

---

### Q3: Can NodeInterrupt be thrown multiple times in the same node?

cannot. Once `NodeInterrupt` is thrown, node execution stops immediately:

```python
def check(state):
    if condition_1:
        raise NodeInterrupt("条件 1 触发")

    # ❌ 如果条件 1 为真，这里永远不会执行
    if condition_2:
        raise NodeInterrupt("条件 2 触发")
```

**Solution:** Combine conditions or use multiple nodes
```python
def check(state):
    errors = []
    if condition_1:
        errors.append("条件 1 失败")
    if condition_2:
        errors.append("条件 2 失败")

    if errors:
        raise NodeInterrupt(f"检测到问题: {', '.join(errors)}")
```

---

### Q4: How to completely cancel execution after interruption instead of continuing?

There are two methods:

**Method 1: Update status to termination flag**
```python
class State(TypedDict):
    input: str
    cancelled: bool

def check(state):
    if should_cancel(state):
        raise NodeInterrupt("操作需要取消")
    return state

def next_step(state):
    if state.get('cancelled'):
        return END  # 直接结束
    # 正常逻辑
    return state

# 用户决定取消
graph.update_state(thread_config, {"cancelled": True})
```

**Method 2: Continue execution without calling stream**
```python
# 检查中断原因
state = graph.get_state(thread_config)
if "cancel" in state.tasks[0].interrupts[0].value.lower():
    # 不调用 stream，执行就此结束
    print("操作已取消")
else:
    # 否则修改状态并继续
    graph.update_state(thread_config, new_state)
    graph.stream(None, thread_config)
```

---

### Q5: Can dynamic breakpoints be used in conditional edges?

`NodeInterrupt` cannot be thrown directly in the conditional function:

```python
# ❌ 这不会工作
def route(state):
    if needs_approval(state):
        raise NodeInterrupt("需要审批")  # 条件函数中无效
    return "next_node"

builder.add_conditional_edges("start", route)
```

**Correct approach:** Throw it in the node and then use conditional edge routing
```python
def approval_node(state):
    if needs_approval(state):
        raise NodeInterrupt("需要审批")
    return state

def route(state):
    if state.get('approved'):
        return "continue"
    else:
        return "reject"

builder.add_node("approval", approval_node)
builder.add_conditional_edges("approval", route, ["continue", "reject"])
```

---

## 📖 Further reading

- [LangGraph Dynamic Breakpoints official document](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/dynamic_breakpoints/)
- [Complete Guide to Human-in-the-Loop](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/)
- [LangGraph API Reference](https://langchain-ai.github.io/langgraph/reference/graphs/)

---

## 🎉 Summary

Dynamic Breakpoints is a powerful human-computer interaction mechanism in LangGraph that allows the graph to intelligently decide when human intervention is needed based on business logic. Key takeaways:

1. **Use `NodeInterrupt`** to trigger dynamic interrupts inside the node
2. **Pass details** Tell the user why the interruption occurred
3. **CHECK STATUS** Use `get_state()` to understand the cause of the interruption
4. **Modify status** Use `update_state()` to solve the problem
5. **Continue execution** Call `stream(None, ...)` to resume from the interruption point

By combining static and dynamic breakpoints, you can build flexible, intelligent AI applications that find the perfect balance between automation and human control!