"""Run the control suite and publish its result to the Actions job summary."""
import json
import os
from pathlib import Path
import platform
import sys
import unittest


def main():
    suite = unittest.defaultTestLoader.discover(str(Path(__file__).parent), pattern='test_*.py')
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    passed = result.wasSuccessful() and result.testsRun > 0 and not result.skipped
    record = {
        'scope': 'Protocol and control logic',
        'commit': os.environ.get('GITHUB_SHA'),
        'python': platform.python_version(),
        'tests': result.testsRun,
        'failures': len(result.failures),
        'errors': len(result.errors),
        'skipped': len(result.skipped),
        'status': 'passed' if passed else 'failed',
    }
    print(json.dumps(record, ensure_ascii=False), flush=True)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        lines = [
            '## AeroSense Control — 协议与控制逻辑验证',
            '',
            f"**{record['status'].upper()} · {record['tests']} tests**",
            '',
            '| 项目 | 记录 |',
            '|---|---|',
            f"| 源码提交 | `{record['commit']}` |",
            f"| Python | {record['python']} |",
            f"| 失败 / 错误 / 跳过 | {record['failures']} / {record['errors']} / {record['skipped']} |",
            '',
            '覆盖协议通信、参数写入与读回、联锁、断连与超时、指令去重、记录与恢复。',
            '',
            '测试使用本机协议测试设备；本记录对应软件协议和控制逻辑验证。',
            '',
            '逐项结果见 Verify protocol and control logic 步骤日志。',
            '',
        ]
        with open(summary, 'a', encoding='utf-8') as stream:
            stream.write('\n'.join(lines))
    return 0 if passed else 1


if __name__ == '__main__':
    sys.exit(main())
