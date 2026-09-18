"""官方Paddle model(inputs)基线；读取产品预处理的同一Float32 tensor。"""
import os
os.environ['OMP_NUM_THREADS']='4'
import datetime, gzip, hashlib, json, platform, sys, time
from pathlib import Path
import numpy as np
from pycocotools import mask as mask_util

ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'.tmp/acceptance-20260918'
REPORT=ROOT/'reports/2026-09-18-image-sdk'
UPSTREAM=ROOT.parent/'web-sdk-PP-Detection/.tmp/phase2/upstream/PaddleDetection-b25522a0f4bde8c80603f3ba5e3472059972e3b5'
WEIGHTS=ROOT.parent/'chenmohan123.github.io/.tmp/segmentation-20260918/ppyoloe_seg_s_80e_coco.pdparams'
sys.path.insert(0,str(UPSTREAM))
import paddle
from ppdet.core.workspace import create, load_config
paddle.set_device('cpu')
cfg=load_config(str(UPSTREAM/'configs/ppyoloe_seg/ppyoloe_seg_s_80e_coco.yml'))
model=create(cfg.architecture)
missing,unexpected=model.set_state_dict(paddle.load(str(WEIGHTS)))
assert not missing and not unexpected
model.eval()
model.yolo_head.nms.keep_top_k=100
assert model.yolo_head.nms.score_threshold==0.01
assert model.yolo_head.nms.nms_threshold==0.7
lock=json.loads((REPORT/'dataset.lock.json').read_text(encoding='utf8'))
results=[]
for case in lock['cases']:
    binary=(WORK/'inputs'/f"{case['imageId']}.f32").read_bytes()
    assert hashlib.sha256(binary).hexdigest()==case['tensorSha256']
    tensor=np.frombuffer(binary,dtype=np.float32).reshape(1,3,640,640)
    inputs={'image':paddle.to_tensor(tensor),'im_shape':paddle.to_tensor([[640.,640.]]),'scale_factor':paddle.to_tensor([[640/case['height'],640/case['width']]],dtype='float32')}
    started=time.perf_counter()
    with paddle.no_grad(): result=model(inputs)
    elapsed=(time.perf_counter()-started)*1000
    boxes=result['bbox'].numpy(); masks=result['mask'].numpy().astype(np.uint8)
    instances=[]
    for box,mask in zip(boxes,masks):
        if box[1]<=.01: continue
        rle=mask_util.encode(np.asfortranarray(mask)); rle['counts']=rle['counts'].decode('ascii')
        instances.append({'classId':int(box[0]),'score':float(box[1]),'box':{'x':float(box[2]),'y':float(box[3]),'width':float(box[4]-box[2]),'height':float(box[5]-box[3])},'segmentation':rle})
    results.append({'imageId':case['imageId'],'image':{'width':case['width'],'height':case['height']},'instances':instances,'officialMs':elapsed})
    print(json.dumps({'imageId':case['imageId'],'instances':len(instances),'officialMs':elapsed}),flush=True)
with gzip.open(REPORT/'paddle-results.json.gz','wt',encoding='utf8') as out: json.dump(results,out,separators=(',',':'))
(REPORT/'paddle-execution.json').write_text(json.dumps({'status':'completed','verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'python':platform.python_version(),'paddle':paddle.__version__,'device':'cpu','threads':4,'upstreamRevision':'b25522a0f4bde8c80603f3ba5e3472059972e3b5','weightsSha256':hashlib.sha256(WEIGHTS.read_bytes()).hexdigest(),'scoreThreshold':.01,'nmsThreshold':.7,'maxDetections':100,'images':len(results)},indent=2)+'\n',encoding='utf8')
