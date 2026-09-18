"""从已归档官方实验提取单瓶32通道局部原型和官方二值掩码；不调用SDK。"""
import gzip
import json
import sys
from pathlib import Path

import numpy as np

archive = Path(sys.argv[1])
data = np.load(archive / 'reference' / '000000010977.npz')
row = json.loads((archive / 'reference' / '000000010977.json').read_text())[1]
mask = data['masks'][1].ravel()
positions = np.flatnonzero(np.diff(np.r_[0, mask, 0]))
fixture = {
    'source': 'PaddleDetection b25522a0f4bde8c80603f3ba5e3472059972e3b5 官方mask，2026-09-18，COCO 000000010977实例1',
    'width': 500, 'height': 375, 'classId': row['label'], 'score': row['score'],
    'box640': row['box640'], 'coefficients': data['raw2'][0, :, row['index']].tolist(),
    'proto': {'x': 119, 'y': 73, 'width': 11, 'height': 21},
    'prototypes': data['raw3'][0, :, 73:94, 119:130].ravel().tolist(),
    'foregroundRuns': [[int(a), int(b-a)] for a, b in positions.reshape(-1, 2)]
}
target = Path(__file__).with_name('official-bottle.json.gz')
with gzip.GzipFile(filename=str(target), mode='wb', mtime=0) as stream:
    stream.write(json.dumps(fixture, ensure_ascii=False, separators=(',', ':')).encode())
print(target, target.stat().st_size)
