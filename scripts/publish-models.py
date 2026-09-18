"""首版模型分发：准备、显式上传与固定提交完整回读，复用宿主 Hub 登录。"""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import gzip
import hashlib
import json
import re
import shutil
import subprocess
import requests

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'reports/2026-09-18-release-readiness'
STAGE = ROOT / '.tmp/release-models'
REPO = 'chenmohan/web-sdk-pp-segmentation'
PREFIX = 'ppyoloe-seg-s-640/0.1.0'
FILE = 'ppyoloe-seg-s-640-fp32.onnx'
IDENTITY = {'bytes': 36265193, 'sha256': 'd418de8890fa13ae213aefeff4216bda2dcf961678494cd4baf55d9942a77334'}


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


def identity(data):
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def now():
    return datetime.now(timezone.utc).isoformat()


def files(folder):
    return [{'path': f.relative_to(folder).as_posix(), **identity(f.read_bytes())}
            for f in sorted(folder.rglob('*')) if f.is_file()]


def head(source):
    if source == 'huggingface':
        from huggingface_hub import HfApi
        return HfApi().model_info(REPO).sha
    return subprocess.check_output(['git', '-c', 'http.sslBackend=openssl', 'ls-remote',
        f'https://www.modelscope.cn/{REPO}.git', 'refs/heads/master'], text=True).split()[0]


def address(source, revision, path):
    origin = 'https://www.modelscope.cn/models' if source == 'modelscope' else 'https://huggingface.co'
    return f'{origin}/{REPO}/resolve/{revision}/{path}'


def prepare():
    data = (ROOT / '.tmp/model.onnx').read_bytes()
    require(identity(data) == IDENTITY, '本地模型身份不符')
    decision = read(REPORT / 'license/sources.lock.json')
    require(decision['decision'] == 'apache-2.0-supported-by-pinned-project-release-context-and-official-model-table', '缺少已记录的许可采用依据')
    require(read(ROOT / 'reports/2026-09-18-original-size/acceptance.json')['status'] == 'passed', '原图尺寸质量验收未通过')
    old = ROOT.parent / 'chenmohan123.github.io/reports/segmentation/2026-09-18-feasibility'
    conversion = read(old / 'conversion.json')
    require({k: conversion['model'][k] for k in IDENTITY} == IDENTITY, '转换证据模型不符')
    license_data = gzip.decompress((old / 'upstream/LICENSE.gz').read_bytes())
    require(identity(license_data) == {'bytes': 11357, 'sha256': 'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4'}, '上游许可证摘要不符')
    (ROOT / 'models/LICENSE').write_bytes(license_data)
    conversion.update({'version': '0.1.0', 'reproduction': 'https://github.com/chenmohan123/chenmohan123.github.io/tree/main/reports/segmentation/2026-09-18-feasibility/reproduction',
        'weightUrl': decision['weight']['url'], 'weightBytes': decision['weight']['bytes'],
        'modification': '保留训练权重；导出固定单图四张量原始分割头，NMS与原图掩码恢复移至SDK。未量化或重新训练。'})
    dump(ROOT / 'models/conversion.json', conversion)
    target = STAGE / 'weights' / PREFIX
    target.mkdir(parents=True, exist_ok=True)
    for name in ('LICENSE', 'conversion.json', 'README.md', 'README.en.md'):
        shutil.copyfile(ROOT / 'models' / name, target / name)
    shutil.copyfile(ROOT / 'NOTICE', target / 'NOTICE')
    (target / FILE).write_bytes(data)
    (STAGE / 'weights/README.md').write_text(f'''---
license: apache-2.0
pipeline_tag: image-segmentation
tags:
- onnx
- webgpu
- wasm
---

# PP-Segmentation Web SDK 模型

[中文模型卡]({PREFIX}/README.md) · [English model card]({PREFIX}/README.en.md)

由 chenmohan 维护的 PaddleDetection PP-YOLOE_seg_s 640 FP32 ONNX 镜像，非 Paddle 官方账号。
单帧 COCO 80 类实例分割；36,265,193 字节。桌面 WASM/WebGPU × main/Worker 有日期化验证，不声明移动端或 NPU 兼容。

Apache-2.0 采用依据为固定官方仓库的项目发布声明与模型表；没有单独点名权重的许可证。完整来源、摘要、转换和许可范围见模型卡及随附 LICENSE/NOTICE。

Maintained by chenmohan, not the official Paddle account. PP-YOLOE_seg_s 640 FP32 performs single-image COCO instance segmentation. Dated desktop WASM/WebGPU evidence is available; mobile and NPU remain unverified. Apache-2.0 is adopted from the pinned official project release statement and model table; no separate weight-specific license was found. See the model cards for provenance, hashes, conversion and scope.
''', encoding='utf-8')
    dump(REPORT / 'distribution-prepared.json', {'preparedAt': now(), 'repository': REPO, 'model': IDENTITY, 'files': files(STAGE / 'weights')})
    print('模型、双语模型卡、许可与转换记录已准备并核验。')


def upload(source, phase):
    folder = STAGE / phase
    receipt = REPORT / f'distribution-{phase}-{source}.json'
    expected = files(folder)
    require(bool(expected), '暂存为空')
    if receipt.exists():
        require(read(receipt)['files'] == expected, '已上传文件身份改变')
        print(source, phase, '已有固定回执，跳过重复上传')
        return
    if phase == 'weights':
        require(expected == read(REPORT / 'distribution-prepared.json')['files'], '暂存与已准备文件不符')
    if source == 'huggingface':
        from huggingface_hub import HfApi
        api = HfApi()
        if phase == 'weights':
            api.create_repo(repo_id=REPO, repo_type='model', private=False, exist_ok=False)
        parent = head(source)
        revision = api.upload_folder(repo_id=REPO, repo_type='model', folder_path=str(folder), parent_commit=parent,
            commit_message=f'发布 PP-Segmentation 0.1.0：{phase}').oid
    else:
        from modelscope.hub.api import HubApi
        api = HubApi()
        if phase == 'weights':
            api.create_repo(REPO, repo_type='model', visibility=5, license='Apache License 2.0', exist_ok=False)
        parent = head(source)
        api.upload_folder(repo_id=REPO, repo_type='model', folder_path=str(folder),
            commit_message=f'发布 PP-Segmentation 0.1.0：{phase}', sync_remote_repo=False,
            max_workers=1, disable_tqdm=True, use_cache=False)
        revision = head(source)
    require(bool(re.fullmatch('[a-f0-9]{40}', revision)), '远程 revision 无效')
    dump(receipt, {'source': source, 'repository': REPO, 'phase': phase, 'parent': parent, 'revision': revision,
        'uploadedAt': now(), 'files': expected})
    print(source, phase, revision)


def verify(phase):
    rows = []
    for source in ('modelscope', 'huggingface'):
        receipt = read(REPORT / f'distribution-{phase}-{source}.json')
        require(receipt['files'] == files(STAGE / phase), '暂存文件集合改变')
        for entry in receipt['files']:
            url = address(source, receipt['revision'], entry['path'])
            with requests.get(url, timeout=(30, 120)) as response:
                response.raise_for_status()
                require(identity(response.content) == {k: entry[k] for k in IDENTITY}, '远程文件身份不符：' + entry['path'])
            rows.append({'source': source, 'revision': receipt['revision'], 'url': url, **entry, 'verifiedAt': now(), 'passed': True})
    dump(REPORT / f'distribution-{phase}-verified.json', {'status': 'passed', 'verifiedAt': now(), 'model': IDENTITY, 'results': rows})
    if phase == 'weights':
        sources = []
        for source in ('modelscope', 'huggingface'):
            revision = read(REPORT / f'distribution-{phase}-{source}.json')['revision']
            path = PREFIX + '/' + FILE
            sources.append({'kind': source, 'repository': REPO, 'revision': revision, 'path': path,
                'downloadUrl': address(source, revision, path), **IDENTITY})
        manifest = read(ROOT / 'models/model.json')
        manifest.update({'version': '0.1.0', 'status': 'stable', 'sources': sources})
        dump(ROOT / 'models/model.json', manifest)
        dump(STAGE / 'metadata' / PREFIX / 'model.json', manifest)
    print(phase, '双源固定提交全部文件完整 GET 校验通过。')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'upload', 'verify'])
    parser.add_argument('--source', choices=['modelscope', 'huggingface'])
    parser.add_argument('--phase', choices=['weights', 'metadata'], default='weights')
    args = parser.parse_args()
    if args.action == 'prepare':
        prepare()
    elif args.action == 'verify':
        verify(args.phase)
    else:
        require(args.source is not None, '上传需要显式指定来源')
        upload(args.source, args.phase)
