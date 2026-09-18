"""解释低于0.99的严格匹配项；诊断不覆盖、不放宽主验收结果。"""
import datetime,gzip,json
from pathlib import Path
import numpy as np
from pycocotools import mask as mask_util
ROOT=Path(__file__).resolve().parents[2]
REPORT=ROOT/'reports/2026-09-18-image-sdk'
def read(name):
    with gzip.open(REPORT/name,'rt',encoding='utf8') as stream:return json.load(stream)
comparisons=read('instance-comparisons.json.gz')
baseline={row['imageId']:row for row in read('paddle-results.json.gz')}
output={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'仅定位严格门槛失败原因，原始SDK与官方mask不修改，验收仍按完整原图maskIoU>=0.99判断','failures':[]}
for mode in ['wasm-main','wasm-worker','webgpu-main','webgpu-worker']:
    sdk={row['imageId']:row for row in read(mode+'-results.json.gz')['results']}
    for match in comparisons['paddle-'+mode]:
        if match['maskIoU']>=.99:continue
        source=baseline[match['imageId']]
        a=next(x for x in source['instances'] if x['classId']==match['classId'] and x['score']==match['referenceScore'])
        b=next(x for x in sdk[match['imageId']]['instances'] if x['classId']==match['classId'] and x['score']==match['candidateScore'])
        original=mask_util.decode(a['segmentation']);mask=b['mask'];counts=np.asarray(mask['counts'],np.int64)
        roi=np.repeat(np.arange(len(counts))%2,counts).astype(np.uint8).reshape(mask['height'],mask['width'])
        candidate=np.zeros((source['image']['height'],source['image']['width']),np.uint8)
        candidate[mask['y']:mask['y']+mask['height'],mask['x']:mask['x']+mask['width']]=roi
        canvas=np.zeros_like(candidate);canvas[:original.shape[0],:original.shape[1]]=original
        cropped=candidate[:original.shape[0],:original.shape[1]]
        union=np.count_nonzero(cropped|original);common_iou=float(np.count_nonzero(cropped&original)/union) if union else 1.
        diff=candidate!=canvas;inside=np.zeros_like(diff);inside[:original.shape[0],:original.shape[1]]=True
        output['failures'].append({'mode':mode,**match,'originalImage':source['image'],'officialMaskShape':list(original.shape),'officialForeground':int(original.sum()),'sdkForeground':int(candidate.sum()),'differentPixels':int(np.count_nonzero(diff)),'differentPixelsInsideOfficialExtent':int(np.count_nonzero(diff&inside)),'differentPixelsOutsideOfficialExtent':int(np.count_nonzero(diff&~inside)),'commonExtentMaskIoU':common_iou,'diagnosis':'全部差异仅在官方int裁剪丢失的边缘' if np.count_nonzero(diff&inside)==0 else '官方共同区域也存在差异，需进一步定位'})
(REPORT/'edge-diagnosis.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(output,ensure_ascii=False))
