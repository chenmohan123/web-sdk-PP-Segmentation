"""记录同RGBA的OpenCV缩放与SDK缩放差异，不替代同tensor基线。"""
import json
from pathlib import Path
import cv2
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
REPORT=ROOT/'reports/2026-09-18-image-sdk'
DATA=ROOT.parent/'web-sdk-PP-Detection/.tmp/phase2/dataset'
lock=json.loads((REPORT/'dataset.lock.json').read_text(encoding='utf8'))
rows=[]
for case in lock['cases']:
    rgba=np.fromfile(DATA/'rgba'/(case['filename']+'.rgba'),dtype=np.uint8).reshape(case['height'],case['width'],4)
    assert np.all(rgba[:,:,3]==255)
    cv_tensor=(cv2.resize(rgba[:,:,:3],(640,640),interpolation=cv2.INTER_CUBIC).astype(np.float32)/np.float32(255)).transpose(2,0,1)
    sdk=np.fromfile(ROOT/'.tmp/acceptance-20260918/inputs'/f"{case['imageId']}.f32",dtype=np.float32).reshape(3,640,640)
    delta=np.abs(sdk-cv_tensor)
    rows.append({'imageId':case['imageId'],'maxAbs':float(delta.max()),'meanAbs':float(delta.mean()),'differentValues':int(np.count_nonzero(delta)),'values':int(delta.size)})
report={'opencv':cv2.__version__,'scope':'同一固定RGBA的RGB INTER_CUBIC比较，仅缩放差异；SDK基线始终使用产品实际tensor。','images':rows,'maxAbs':max(x['maxAbs'] for x in rows),'meanAbsAcrossImages':float(np.mean([x['meanAbs'] for x in rows]))}
(REPORT/'preprocessing-comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='images'},ensure_ascii=False))
