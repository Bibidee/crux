from datetime import datetime, timezone
import os
import tempfile
import sys

# gltest 0.29.2 injects calldata through fd 0 and immediately unlinks the
# backing tempfile. Windows refuses to unlink an open file, so the upstream
# helper aborts before any contract code runs. Keep the same calldata path but
# defer cleanup; this is test-harness compatibility only and does not alter the
# GenVM contract/runtime behavior.
try:
    import gltest.direct.loader as _loader

    def _windows_safe_inject_message_to_fd0(vm):
        from genlayer.py import calldata
        from genlayer.py.types import Address
        sender_addr = vm.sender
        if isinstance(sender_addr, bytes):
            sender_addr = Address(sender_addr)
        contract_addr = vm._contract_address
        if isinstance(contract_addr, bytes):
            contract_addr = Address(contract_addr)
        origin_addr = vm.origin
        if isinstance(origin_addr, bytes):
            origin_addr = Address(origin_addr)
        encoded = calldata.encode({
            "contract_address": contract_addr,
            "sender_address": sender_addr,
            "origin_address": origin_addr,
            "stack": [],
            "value": vm._value,
            "datetime": vm._datetime,
            "is_init": False,
            "chain_id": vm._chain_id,
            "entry_kind": 0,
            "entry_data": b"",
            "entry_stage_data": None,
        })
        fd, path = tempfile.mkstemp()
        os.write(fd, encoded)
        os.lseek(fd, 0, os.SEEK_SET)
        vm._original_stdin_fd = os.dup(0)
        os.dup2(fd, 0)
        os.close(fd)
        # Keep the path referenced for the duration of this test process. The
        # fd-0 reader still owns the file on Windows.
        paths = getattr(vm, "_crux_calldata_paths", [])
        paths.append(path)
        vm._crux_calldata_paths = paths

    _loader._inject_message_to_fd0 = _windows_safe_inject_message_to_fd0
except ImportError:
    pass

NOW = 2_000_000_000


def addr(value):
    raw = value.as_bytes if hasattr(value, "as_bytes") else value
    return "0x" + raw.hex() if isinstance(raw, bytes) else str(value)


def warp(vm, unix=NOW):
    value = datetime.fromtimestamp(unix, timezone.utc).isoformat()
    vm.warp(value)
    for name in ("_contract_crux_registry", "_contract_evidence_verifier", "_contract_closure_judge"):
        module = sys.modules.get(name)
        if module:
            module.gl.message_raw["datetime"] = value


def capture(vm):
    transfers, messages = [], []
    def hook(_vm, request):
        if "EthSend" in request:
            transfers.append(request["EthSend"])
            return {"ok": None}
        if "PostMessage" in request:
            messages.append(request["PostMessage"])
            return {"ok": None}
        return None
    vm._gl_call_hook = hook
    return transfers, messages
