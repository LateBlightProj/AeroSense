# AeroSense Control

设备控制服务与生产监控台。服务通过Modbus TCP读取测点、下发指令，并将设备应答、读回结果与历史采集写入SQLite。

## 结构

```text
生产监控台 / 调用方
        │ HTTP · Server-Sent Events
控制服务 ── 参数边界、联锁核对、指令队列、执行回执
        │ Modbus TCP
PLC / 设备网关 ── 输入寄存器、保持寄存器、线圈、离散输入
        │
SQLite ── 指令、运行事件、历史采集
```

`modbus.py`负责协议收发与工程量换算，`core.py`负责采集和指令生命周期，`server.py`提供接口，`web/`提供监控台。后端只使用Python标准库，要求Python 3.10或更高版本。

## 设备配置

复制`config.example.json`为`config.local.json`，按设备手册修改地址、寄存器与量程。示例配置中的寄存器布局是配置格式示例，接入前须替换为实际PLC或网关的测点表。

```sh
cp control/config.example.json control/config.local.json
python -m control.server --config control/config.local.json
```

打开`http://127.0.0.1:8765`。未设置操作凭证或未启用设备写入时，可查看采集数据，不能下发指令。授权操作人员可生成凭证，并设置配置中的`write_enabled`：

```sh
export AEROSENSE_CONTROL_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
python -m control.server --config control/config.local.json
```

监控台的“操作凭证”输入同一凭证。凭证仅保留在页面内存中，不写入浏览器存储、网址或运行日志。默认服务绑定本机回环地址；跨主机部署时，通过带认证和TLS的反向代理接入。

| 字段 | 含义 |
|---|---|
| `protocol` | 当前支持`modbus_tcp` |
| `host`、`port`、`unit_id` | 设备连接参数 |
| `timeout_seconds` | 每次协议交换的总超时时间 |
| `bank` | `input`、`holding`、`coil`或`discrete` |
| `address` | 从0起算的协议地址；设备手册中的40001通常对应保持寄存器地址0，须按厂商手册确认 |
| `type` | `uint16`、`int16`、`uint32`、`int32`或`float32` |
| `word_order` | 两个寄存器组成32位数时的字顺序，`big`或`little` |
| `scale`、`offset` | 工程值＝寄存器解码值×比例＋偏移 |
| `writable`、`min`、`max` | 测点写入权限与工程值范围 |
| `verify_tolerance` | 指令值与读回值允许的差值；线圈使用0 |
| `interlocks` | 指令下发前必须满足的测点条件 |

联锁支持`equals`、`min`、`max`。可用`when_value`限定条件适用的指令值，例如仅在线圈启动值为1时检查液位，允许在液位不足时下发关闭值0。软件联锁在执行前重新读取；PLC侧的设备联锁与保护仍由PLC执行。

协议功能码为1、2、3、4、5、6、16；读取按连续地址分组，核验事务编号、功能码、数据长度与写入应答。协议依据见[Modbus官方说明](https://www.modbus.org/introduction-to-modbus)。

## 指令与反馈

```text
queued → sent → acknowledged → verified
                         └──→ failed
服务重启前未完成的指令 ───────→ interrupted
```

`acknowledged`表示设备已应答；`verified`表示对应寄存器或线圈的读回值与指令一致。温度到达目标、喷雾实际完成等生产结果，需要相应的独立测点确认，不能用写入回执代替。

相同`requestId`和相同内容返回原指令回执，不重复写入；相同编号对应不同内容返回409。重启后未完成的指令记为`interrupted`，不自动重发。断连、过期反馈、越界参数、联锁不满足或审计记录不可写时，服务不下发新指令。

采集质量分为`good`、`bad`、`stale`、`unavailable`。断连后保留最近值和原采集时间，并标记异常；首次未采集时值为`null`。监控台展示质量状态，不生成替代读数。

## 接口

| 方法与地址 | 内容 |
|---|---|
| `GET /api/v1/health` | 服务状态 |
| `GET /api/v1/metadata` | 设备、测点、单位、权限与参数范围 |
| `GET /api/v1/telemetry` | 当前采集值、质量、时间戳与连接状态 |
| `GET /api/v1/stream` | SSE采集流，事件名称`telemetry` |
| `POST /api/v1/commands` | 带Bearer凭证提交指令 |
| `GET /api/v1/commands/{id}` | 指令回执 |
| `GET /api/v1/events?after=0&limit=100` | 按事件编号增量读取运行记录 |
| `GET /api/v1/history?device=B05&since=0&limit=500` | 历史采集，`since`为Unix秒时间戳 |

指令请求体示例：

```json
{
  "device": "B05",
  "point": "root_target_temperature",
  "value": 18,
  "requestId": "operator_request_0001"
}
```

接口返回202和指令编号后，调用方继续查询回执直至`verified`、`failed`或`interrupted`。错误返回`error`字段。常见状态码：400参数错误、401凭证错误、403写入未启用、409指令冲突或联锁不满足、503服务或设备反馈不可用。

## 数据与测试

数据库默认位于`control/state/control.sqlite3`，可通过`--database`指定。历史采集每设备保留最近10000帧；指令与事件持续保存。`config.local.json`、运行数据库和凭证不纳入仓库。

```sh
python -m unittest discover -s control/tests -v
```

测试启动仅绑定本机回环地址的协议测试端点，覆盖协议收发、读回、重复提交、通信异常、超时、联锁、审计失败、重启恢复与HTTP接口。实际接入还需按目标设备测点表完成硬件联调。
