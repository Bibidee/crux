from datetime import datetime, timezone
import os
import tempfile
import sys
import json
from pathlib import Path
from typing import Any, Callable
import pytest

_VALIDATOR_SENTINEL = object()

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

# gltest-direct otherwise follows GitHub's latest release, which currently
# resolves to an unavailable rc asset. The contracts declare the v0.2.12 SDK
# hash and this official release contains the matching runner artifact.
import gltest.direct.loader as _direct_loader
from gltest.direct.loader import deploy_contract

# gltest 0.29.2 still imports the storage package from `genlayer.storage`,
# while the pinned v0.2.12 Studionet SDK exposes it at `genlayer.py.storage`.
# Keep tests on the declared SDK and bridge only the test runner's allocator.
def _allocate_contract_studionet(contract_cls, vm, *args, **kwargs):
    from genlayer.py.storage import ROOT_SLOT_ID
    from genlayer.py.storage._internal.generate import (
        ORIGINAL_INIT_ATTR, _storage_build,
    )

    type_desc = _storage_build(contract_cls, {})
    slot = vm._storage.get_store_slot(ROOT_SLOT_ID)
    instance = type_desc.get(slot, 0)
    contract_type = getattr(type_desc, "cls", None)
    init = getattr(contract_type, "__init__", None) if contract_type is not None else getattr(contract_cls, "__init__", None)
    if init is not None:
        if hasattr(init, ORIGINAL_INIT_ATTR):
            init = getattr(init, ORIGINAL_INIT_ATTR)
        init(instance, *args, **kwargs)
    return instance


_direct_loader._allocate_contract = _allocate_contract_studionet

# The v0.2.12 SDK stores the active message in the contract module's
# ``gl.message_raw`` mapping. gltest 0.29.2 refreshes only the newer
# ``genlayer.message`` module, so updates to vm.sender/value after deployment
# otherwise never reach subsequent contract calls. Synchronize that mapping at
# the proxy boundary while retaining gltest's calldata-roundtrip proxy.
_make_contract_proxy = _direct_loader._make_contract_proxy

def _make_contract_proxy_with_message(instance):
    from gltest.direct import wasi_mock

    vm = wasi_mock.get_vm()
    proxy = _make_contract_proxy(instance)

    class MessageProxy:
        def __getattr__(self, name):
            attr = getattr(proxy, name)
            if not callable(attr):
                return attr

            def _call(*args, **kwargs):
                from genlayer.py.types import Address, u256

                module = sys.modules.get(type(instance).__module__)
                gl_module = getattr(module, "gl", None)
                raw = getattr(gl_module, "message_raw", None)
                if isinstance(raw, dict):
                    raw.update({
                        "contract_address": Address(vm._contract_address),
                        "sender_address": Address(vm.sender),
                        "origin_address": Address(vm.origin),
                        "value": u256(vm._value),
                        "datetime": vm._datetime,
                        "chain_id": u256(vm._chain_id),
                    })
                    gl_module.message = gl_module.MessageType(
                        contract_address=raw["contract_address"],
                        sender_address=raw["sender_address"],
                        origin_address=raw["origin_address"],
                        value=raw["value"],
                        chain_id=raw["chain_id"],
                    )
                return attr(*args, **kwargs)
            return _call

        def __setattr__(self, name, value):
            setattr(proxy, name, value)

    return MessageProxy()

_direct_loader._make_contract_proxy = _make_contract_proxy_with_message

def _patch_pinned_genvm_nondeterminism(vm):
    # v0.2.12 exposes consensus APIs under genlayer.gl.vm; the installed
    # gltest adapter patches the newer genlayer.vm namespace instead.
    import genlayer.gl.vm as genlayer_vm
    import genlayer.gl.nondet as genlayer_nondet
    from gltest.direct import wasi_mock
    from genlayer.py.types import Lazy

    if not getattr(wasi_mock, "_crux_studionet_compat", False):
        original_gl_call = wasi_mock.gl_call
        def studionet_compat_gl_call(data, /):
            from genlayer.py import calldata
            request = calldata.decode(data)
            active_vm = wasi_mock.get_vm()
            if isinstance(request, dict) and ("PostMessage" in request or "EthSend" in request):
                hook = active_vm._gl_call_hook
                if hook is not None:
                    hook(active_vm, request)
                    if "PostMessage" not in request:
                        return original_gl_call(data)
                    # gltest 0.29.2's v0.3 runner does not forward v0.2.12
                    # PostMessage calls through its direct-mode hook.
                    return 2**32 - 1
            return original_gl_call(data)
        wasi_mock.gl_call = studionet_compat_gl_call
        wasi_mock._crux_studionet_compat = True

    def run_nondet_unsafe(leader_fn, validator_fn, /, **kwargs):
        vm = wasi_mock.get_vm()
        result = leader_fn()
        vm._captured_validators.append((result, leader_fn, validator_fn))
        return result

    def run_nondet(leader_fn, validator_fn, /, **kwargs):
        return run_nondet_unsafe(leader_fn, validator_fn, **kwargs)

    def run_nondet_default(leader_fn, validator_fn, /, **kwargs):
        return run_nondet_unsafe(leader_fn, validator_fn, **kwargs)

    def exec_prompt(prompt, **config):
        vm = wasi_mock.get_vm()
        response = vm._match_llm_mock(prompt)
        if response is None:
            raise RuntimeError(f"No direct-test LLM mock matched: {prompt[:120]}")
        if config.get("response_format") == "json" and isinstance(response, str):
            return json.loads(response)
        return response

    if not getattr(genlayer_vm, "_crux_direct_mode", False):
        run_nondet_unsafe.lazy = lambda leader, validator, /, **kwargs: Lazy(
            lambda: run_nondet_unsafe(leader, validator, **kwargs))
        run_nondet.lazy = lambda leader, validator, /, **kwargs: Lazy(
            lambda: run_nondet(leader, validator, **kwargs))
        run_nondet_default.lazy = lambda leader, validator, /, **kwargs: Lazy(
            lambda: run_nondet_default(leader, validator, **kwargs))
        exec_prompt.lazy = lambda prompt, **config: Lazy(lambda: exec_prompt(prompt, **config))
        genlayer_vm.run_nondet_unsafe = run_nondet_unsafe
        genlayer_vm.run_nondet = run_nondet
        genlayer_vm.run_nondet_default = run_nondet_default
        genlayer_nondet.exec_prompt = exec_prompt
        genlayer_vm._crux_direct_mode = True

    def run_validator(*, leader_result=_VALIDATOR_SENTINEL, leader_error=None, index=-1):
        vm = wasi_mock.get_vm()
        from genlayer.gl import vm as gl_vm

        stored_result, _leader_fn, validator_fn = vm._captured_validators[index]
        if leader_error is not None:
            wrapped = gl_vm.UserError(str(leader_error))
        else:
            # Keep the sentinel distinction compatible with gltest's public API.
            wrapped = gl_vm.Return(calldata=stored_result if leader_result is _VALIDATOR_SENTINEL else leader_result)
        return validator_fn(wrapped)

    vm.run_validator = run_validator


@pytest.fixture
def direct_deploy(direct_vm) -> Callable[..., Any]:
    def _deploy(contract_path: str, *args: Any, **kwargs: Any) -> Any:
        path = Path(contract_path)
        if not path.is_absolute():
            path = (Path.cwd() / path).resolve()
        contract = deploy_contract(path, direct_vm, *args, sdk_version="v0.2.12", **kwargs)
        _patch_pinned_genvm_nondeterminism(direct_vm)
        return contract
    return _deploy

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
