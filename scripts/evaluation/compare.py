"""从归档ROI/RLE重算64图COCO segm AP与同类别框匹配mask一致性。"""
import contextlib, datetime, gzip, io, json
from pathlib import Path
import numpy as np
from scipy.optimize import linear_sum_assignment
from pycocotools import mask as mask_util
from pycocotools.coco import COCO
from pycocotools.cocoeval import COCOeval

ROOT=Path(__file__).resolve().parents[2]
REPORT=ROOT/'reports/2026-09-18-image-sdk'
DATA=ROOT.parent/'web-sdk-PP-Detection/.tmp/phase2/dataset'
lock=json.loads((REPORT/'dataset.lock.json').read_text(encoding='utf8'))
gt=COCO(str(DATA/'annotations.json'))
categories=sorted(gt.cats)
assert len(categories)==80
ids=[x['imageId'] for x in lock['cases']]

def read(name):
    with gzip.open(REPORT/name,'rt',encoding='utf8') as stream:return json.load(stream)

def rle(instance,image):
    if 'segmentation' in instance:
        encoded=instance['segmentation']
        if encoded['size']==[image['height'],image['width']]:return encoded
        # 官方int(im_shape/scale_factor)可能少裁一行/列；作为左上ROI回填原图，缺失处为0，不拉伸。
        mask=mask_util.decode(encoded)
        assert mask.shape[0]<=image['height'] and mask.shape[1]<=image['width']
        canvas=np.zeros((image['height'],image['width']),np.uint8);canvas[:mask.shape[0],:mask.shape[1]]=mask
        corrected=mask_util.encode(np.asfortranarray(canvas));corrected['counts']=corrected['counts'].decode('ascii');return corrected
    roi=instance['mask']; counts=np.asarray(roi['counts'],dtype=np.int64)
    assert (counts>=0).all() and counts.sum()==roi['width']*roi['height']
    pixels=np.repeat(np.arange(len(counts))%2,counts).astype(np.uint8).reshape(roi['height'],roi['width'])
    mask=np.zeros((image['height'],image['width']),np.uint8)
    assert 0<=roi['x']<=image['width'] and 0<=roi['y']<=image['height']
    assert roi['x']+roi['width']<=image['width'] and roi['y']+roi['height']<=image['height']
    mask[roi['y']:roi['y']+roi['height'],roi['x']:roi['x']+roi['width']]=pixels
    encoded=mask_util.encode(np.asfortranarray(mask));encoded['counts']=encoded['counts'].decode('ascii');return encoded

def normalized(rows):
    return [{**row,'instances':[{**instance,'segmentation':rle(instance,row['image'])} for instance in row['instances']]} for row in rows]

def evaluate(rows):
    predictions=[{'image_id':row['imageId'],'category_id':categories[x['classId']],'score':x['score'],'segmentation':x['segmentation']} for row in rows for x in row['instances']]
    output=io.StringIO()
    with contextlib.redirect_stdout(output):
        evaluator=COCOeval(gt,gt.loadRes(predictions),'segm');evaluator.params.imgIds=ids;evaluator.evaluate();evaluator.accumulate();evaluator.summarize()
    return {'AP':float(evaluator.stats[0]),'AP50':float(evaluator.stats[1]),'AP75':float(evaluator.stats[2]),'APsmall':float(evaluator.stats[3]),'APmedium':float(evaluator.stats[4]),'APlarge':float(evaluator.stats[5]),'stats':evaluator.stats.tolist(),'detections':len(predictions),'log':output.getvalue()}

def box_iou(a,b):
    a,b=a['box'],b['box'];inter=max(0,min(a['x']+a['width'],b['x']+b['width'])-max(a['x'],b['x']))*max(0,min(a['y']+a['height'],b['y']+b['height'])-max(a['y'],b['y']))
    return inter/max(1e-12,a['width']*a['height']+b['width']*b['height']-inter)

def compare(reference,candidate,threshold=.5):
    items=[];ious=[];score_deltas=[];unmatched=[]
    for ra,rb in zip(reference,candidate):
        assert ra['imageId']==rb['imageId']
        a=[x for x in ra['instances'] if x['score']>threshold];b=[x for x in rb['instances'] if x['score']>threshold]
        quality=np.asarray([[box_iou(x,y) if x['classId']==y['classId'] else 0 for y in b] for x in a]).reshape(len(a),len(b))
        ri,ci=linear_sum_assignment(-quality)
        pairs=[(i,j) for i,j in zip(ri,ci) if quality[i,j]>=.5]
        if len(pairs)!=len(a) or len(pairs)!=len(b):unmatched.append({'imageId':ra['imageId'],'reference':len(a),'candidate':len(b),'matched':len(pairs)})
        for i,j in pairs:
            am=mask_util.decode(a[i]['segmentation']);bm=mask_util.decode(b[j]['segmentation']);union=np.count_nonzero(am|bm);iou=float(np.count_nonzero(am&bm)/union) if union else 1.
            delta=abs(a[i]['score']-b[j]['score']);ious.append(iou);score_deltas.append(delta)
            items.append({'imageId':ra['imageId'],'classId':a[i]['classId'],'referenceScore':a[i]['score'],'candidateScore':b[j]['score'],'boxIoU':float(quality[i,j]),'maskIoU':iou})
    return {'passed':not unmatched and min(ious,default=1)>=.99,'scoreThresholdStrictlyGreaterThan':threshold,'matching':'同类别框IoU最大总和一对一匹配，boxIoU>=0.5；双方均检查未匹配实例','matched':len(ious),'minMaskIoU':min(ious,default=1),'meanMaskIoU':float(np.mean(ious)) if ious else 1,'maxScoreDelta':max(score_deltas,default=0),'unmatched':unmatched,'pairs':items}

baseline_raw=read('paddle-results.json.gz')
baseline_canvas_adjustments=[{'imageId':r['imageId'],'image':r['image'],'officialMaskSizes':sorted(set(tuple(x['segmentation']['size']) for x in r['instances'])),'instances':len(r['instances']),'highScoreInstances':sum(x['score']>.5 for x in r['instances'])} for r in baseline_raw if any(x['segmentation']['size']!=[r['image']['height'],r['image']['width']] for x in r['instances'])]
baseline=normalized(baseline_raw)
assert len(baseline)==64
baseline_ap=evaluate(baseline)
result={'status':'failed','verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'dataset':{'images':len(ids),'annotations':len(gt.anns),'annotationsSha256':lock['annotationsSha256']},'criteria':{'maxAPDropPercentagePoints':.5,'minMaskIoU':.99,'scoreThreshold':.01,'maxDetections':100},'baseline':baseline_ap,'modes':{},'mainWorker':{}}
result['baselineMaskCanvasAdjustments']={'reason':'官方ppyoloe_ins_head.py:733使用int(im_shape/scale_factor)裁剪，Float32舍入可使返回mask少一行/列；保留原始RLE，将官方返回结果按左上ROI置入原图画布，缺失边缘为0，不重采样。','images':baseline_canvas_adjustments}
all_modes={}
pair_evidence={}
for backend in ['wasm','webgpu']:
    for mode in ['main','worker']:
        name=f'{backend}-{mode}';raw=read(name+'-results.json.gz');rows=normalized(raw['results']);assert len(rows)==64
        all_modes[name]=rows;ap=evaluate(rows);agreement=compare(baseline,rows);drop=(baseline_ap['AP']-ap['AP'])*100
        times={key:{'median':float(np.median([r['timings'][key] for r in rows])),'p95':float(np.percentile([r['timings'][key] for r in rows],95)),'mean':float(np.mean([r['timings'][key] for r in rows]))} for key in rows[0]['timings']}
        returned=[sum(x['mask']['width']*x['mask']['height'] for x in row['instances']) for row in raw['results']]
        pair_evidence['paddle-'+name]=agreement.pop('pairs')
        agreement['failedMatches']=[x for x in pair_evidence['paddle-'+name] if x['maskIoU']<.99]
        adjusted_pairs=[x for x in pair_evidence['paddle-'+name] if x['imageId'] in {r['imageId'] for r in baseline_canvas_adjustments}]
        agreement['adjustedCanvasHighScoreMatches']={'count':len(adjusted_pairs),'minMaskIoU':min((x['maskIoU'] for x in adjusted_pairs),default=1)}
        result['modes'][name]={'passed':drop<=.5 and agreement['passed'],'ap':ap,'apDropPercentagePoints':drop,'agreement':agreement,'timingsMs':times,'returnedMaskBytes':{'median':float(np.median(returned)),'maximum':max(returned),'total':sum(returned)}}
    result['mainWorker'][backend]=compare(all_modes[backend+'-main'],all_modes[backend+'-worker'],.01)
    pair_evidence[backend+'-main-worker']=result['mainWorker'][backend].pop('pairs')
with gzip.open(REPORT/'instance-comparisons.json.gz','wt',encoding='utf8') as stream:json.dump(pair_evidence,stream,separators=(',',':'))
browser=json.loads((REPORT/'browser-execution.json').read_text(encoding='utf8'))
result['browserStatus']=browser['status']
result['status']='passed' if all(x['passed'] for x in result['modes'].values()) and all(x['passed'] for x in result['mainWorker'].values()) and browser['status']=='passed' else 'failed'
if (REPORT/'postprocess-benchmark.json').exists():
    benchmark=json.loads((REPORT/'postprocess-benchmark.json').read_text(encoding='utf8'))
    result['postprocessBenchmarkStatus']=benchmark['status']
    if benchmark['status']!='passed':result['status']='failed'
if (REPORT/'edge-diagnosis.json').exists():result['edgeDiagnosis']=json.loads((REPORT/'edge-diagnosis.json').read_text(encoding='utf8'))
(REPORT/'acceptance.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
lines=['# 64图公共SDK真实验收','',f"执行时间：{result['verifiedAt']}；状态：**{result['status']}**。",'', '固定64张COCO val2017、716项segmentation标注。scoreThreshold=0.01，nmsThreshold=0.7，maxDetections=100。Paddle官方model(inputs)与公共SDK共享产品预处理生成的Float32输入；浏览器通过公共run({image:RGBA})重新执行同一预处理。','',f"官方基线 segm AP：{baseline_ap['AP']*100:.6f}%。",'', '| 模式 | segm AP (%) | AP下降(百分点) | >0.5最小mask IoU | total中位数(ms) | inference中位数(ms) | postprocess中位数(ms) |','|---|---:|---:|---:|---:|---:|---:|']
for name,entry in result['modes'].items():
    t=entry['timingsMs'];lines.append(f"| {name} | {entry['ap']['AP']*100:.6f} | {entry['apDropPercentagePoints']:.6f} | {entry['agreement']['minMaskIoU']:.8f} | {t['totalMs']['median']:.2f} | {t['inferenceMs']['median']:.2f} | {t['postprocessMs']['median']:.2f} |")
failures=result['modes']['wasm-main']['agreement']['failedMatches']
if failures:
    lines+=['','## 未通过项','']
    for item in failures:lines.append(f"- 图{item['imageId']}，classId={item['classId']}，官方分数{item['referenceScore']:.8f}，maskIoU={item['maskIoU']:.10f}，低于0.99；未排除该实例，整体状态保留failed。")
    if 'edgeDiagnosis' in result:
        for item in result['edgeDiagnosis']['failures'][:1]:lines+=['',f"四模式均为同一项：SDK前景{item['sdkForeground']}像素，官方前景{item['officialForeground']}像素。{item['differentPixelsOutsideOfficialExtent']}个不同像素全部位于官方缺失边缘；共同区域差异{item['differentPixelsInsideOfficialExtent']}像素，诊断用共同区域IoU={item['commonExtentMaskIoU']}。此诊断不替代完整原图门槛；SDK保留正确原图边缘，后续需单独决策上游尺寸语义，当前不能宣称稳定验收通过。"]
lines+=['',f"官方输出有{len(baseline_canvas_adjustments)}图因Float32尺寸除法后int截断少一行/列："+', '.join(str(x['imageId']) for x in baseline_canvas_adjustments)+'。官方原始RLE保留在归档；评测仅按左上原点置于原图画布，缺失边缘填0，不拉伸、不新增前景。受影响实例数、原始尺寸与高分匹配见acceptance.json的baselineMaskCanvasAdjustments及agreement；边缘诊断见edge-diagnosis.json。','', '主线程WASM会阻塞事件循环：首轮10ms定时器取消断言未在结果返回前触发，原始失败记录保留于browser-execution-initial.json。补测确认公共run提交后立即abort返回ABORTED并可恢复；Worker另验证运行中的定时取消。browser-execution.json保留定时器实际触发与结果返回时间，不能据此宣称main内核可强制中断。']
if (REPORT/'postprocess-benchmark.json').exists():
    lines+=['','## 同raw后处理对照','', '独立Node环境，固定第1、22、43图，一次预热、五次交替测量；全部原图二值mask要求完全相同。该三图实验不代替上表64图公共SDK耗时。','', '| 图ID | 分数阈值 | 实例数 | 全图参考中位(ms) | ROI中位(ms) | 全图字节 | ROI字节 |','|---|---:|---:|---:|---:|---:|---:|']
    for entry in benchmark['cases']:lines.append(f"| {entry['imageId']} | {entry['threshold']} | {entry['instances']} | {entry['referenceMedianMs']:.2f} | {entry['optimizedMedianMs']:.2f} | {entry['fullMaskBytes']} | {entry['roiMaskBytes']} |")
lines+=['','AP通过标准为下降≤0.5个百分点；score>0.5同类别框匹配maskIoU≥0.99，双方未匹配实例均计失败。main/worker在score>0.01下另行一致性比较。生命周期实际结果见browser-execution.json，摘要见acceptance.json，逐实例匹配见instance-comparisons.json.gz，逐图输出与耗时见四个results.json.gz。','', '## 复算与边界','', '先执行 `node scripts/evaluation/prepare.mjs`，再用包含Paddle2.6.2、pycocotools的Python执行 `scripts/evaluation/paddle_reference.py`；设置真实Chromium路径后执行 `node tests/acceptance.mjs`，最后执行 `scripts/evaluation/compare.py`。完整操作和依赖路径见scripts/evaluation/README.md。','', '归档包含ROI行优先0/1游程与官方COCO压缩RLE，可脱离模型复算AP和掩码一致性。原始JSON及640tensor仅在忽略目录.tmp/acceptance-20260918；dataset.lock.json保留图片许可、来源、RGBA与tensor SHA256。测试图片含非商用/相同方式共享许可，不作为生产Demo素材再分发。','', '本报告仅覆盖本次Windows桌面、Chromium和真实GPU适配器环境；四模式顺序运行。total为公共run墙钟耗时，不含load及显示绘制；不据此换算产品FPS。不代表完整COCO精度、移动端、NPU或远程分发兼容承诺。']
(REPORT/'README.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
print(json.dumps({k:v for k,v in result.items() if k not in ['modes','mainWorker','baseline']},ensure_ascii=False))
print(json.dumps({name:{'AP':v['ap']['AP'],'drop':v['apDropPercentagePoints'],'minMaskIoU':v['agreement']['minMaskIoU'],'matched':v['agreement']['matched'],'unmatched':v['agreement']['unmatched']} for name,v in result['modes'].items()},ensure_ascii=False))
sys_exit=0 if result['status']=='passed' else 1
raise SystemExit(sys_exit)
