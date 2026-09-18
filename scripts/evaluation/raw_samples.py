"""为独立后处理性能对照捕获三张固定图的同输入ONNX原始输出。"""
import hashlib,json
from pathlib import Path
import numpy as np
import onnxruntime as ort
ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'.tmp/acceptance-20260918'
REPORT=ROOT/'reports/2026-09-18-image-sdk'
lock=json.loads((REPORT/'dataset.lock.json').read_text(encoding='utf8'))
cases=[lock['cases'][i] for i in [0,21,42]]
options=ort.SessionOptions();options.intra_op_num_threads=4
session=ort.InferenceSession(str(ROOT/'.tmp/model.onnx'),options,providers=['CPUExecutionProvider'])
for case in cases:
    binary=(WORK/'inputs'/f"{case['imageId']}.f32").read_bytes()
    assert hashlib.sha256(binary).hexdigest()==case['tensorSha256']
    values=session.run(None,{'image':np.frombuffer(binary,dtype=np.float32).reshape(1,3,640,640)})
    folder=WORK/'raw-samples'/str(case['imageId']);folder.mkdir(parents=True,exist_ok=True)
    case['rawOutputs']=[]
    for i,value in enumerate(values):
        value.tofile(folder/f'{i}.f32');case['rawOutputs'].append({'shape':list(value.shape),'sha256':hashlib.sha256(value.tobytes()).hexdigest()})
(WORK/'raw-samples.json').write_text(json.dumps(cases,indent=2)+'\n',encoding='utf8')
print('已捕获三张真实图片的同输入raw输出')
