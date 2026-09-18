"""只读历史档案和新Paddle参考复算；不导入Paddle、不执行浏览器推理。"""
import ast, datetime, gzip, hashlib, json, sys
from pathlib import Path
import numpy as np
from original_size_reference import ROOT, OLD, OUT, read, sha, write

def validate_rows(rows,cases):
    expected=[c['imageId'] for c in cases]
    assert len(expected)==64 and len(set(expected))==64
    assert len(rows)==len(cases), '图片数缺失，禁止zip静默截断'
    assert [r['imageId'] for r in rows]==expected, '图片ID缺失、重复或乱序'
    for i,row in enumerate(rows):
        assert row['image']=={'width':cases[i]['width'],'height':cases[i]['height']}
        assert len(row['instances'])<=100

def helpers():
    # 复用已经归档的匹配/AP算法；只加载定义，不执行旧脚本的顶层写操作。
    path=ROOT/'scripts/evaluation/compare.py'; tree=ast.parse(path.read_text(encoding='utf8'))
    tree.body=[n for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom,ast.FunctionDef))]
    scope={};exec(compile(tree,str(path),'exec'),scope)
    return scope

def run():
    OUT.mkdir(exist_ok=True,parents=True)
    integrity=read(OLD/'evidence-integrity.json');checked=[]
    if (OUT/'reference-integrity.json').exists():
        for item in read(OUT/'reference-integrity.json')['files']:
            assert sha((OUT/item['name']).read_bytes())==item['sha256'],item['name']
    for item in integrity['files']:
        data=(OLD/item['name']).read_bytes();assert len(data)==item['bytes'] and sha(data)==item['sha256'],item['name']
        checked.append(item)
    lock=read(OLD/'dataset.lock.json'); browser=read(OLD/'browser-execution.json')
    assert browser['sdkSha256']==lock['sdkSha256'] and browser['workerSha256']==lock['workerSha256']
    for name,digest in lock['sourceSha256'].items(): assert sha((ROOT/name).read_bytes())==digest,name
    for name,key in [('index.js','sdkSha256'),('inference.worker.js','workerSha256')]:
        assert sha((ROOT/'.tmp/acceptance-20260918/dist'/name).read_bytes())==lock[key]
        assert sha((ROOT/'dist'/name).read_bytes())==lock[key]
    annotations=ROOT.parent/'web-sdk-PP-Detection/.tmp/phase2/dataset/annotations.json'
    assert sha(annotations.read_bytes())==lock['annotationsSha256']
    scope=helpers(); gt=scope['COCO'](str(annotations)); categories=sorted(gt.cats)
    assert len(categories)==80 and len(gt.anns)==716
    scope.update(gt=gt,categories=categories,ids=[c['imageId'] for c in lock['cases']])
    normalized,evaluate,compare=[scope[k] for k in ('normalized','evaluate','compare')]
    original=read(OLD/'paddle-results.json.gz');corrected=read(OUT/'paddle-original-size-results.json.gz')
    validate_rows(original,lock['cases']);validate_rows(corrected,lock['cases'])
    reference=read(OUT/'reference-execution.json');synthetic=read(OUT/'synthetic.json')
    assert reference['status']=='passed' and synthetic['status']=='passed' and reference['images']==64
    assert [r['imageId'] for r in reference['cases']]==[c['imageId'] for c in lock['cases']]
    for case in reference['cases']:
        assert case['sameForwardBoxesScoresExact'] and case['commonDifferentPixels']==case['archiveMaskDifferentPixels']==case['archiveMaxScoreDelta']==case['archiveMaxBoxDelta']==0
    # 独立由输出再次证明原始共同区域完全相同，而不是只信执行摘要。
    for k,row in enumerate(corrected):
        old=original[k]; assert len(row['instances'])==len(old['instances'])
        for j,instance in enumerate(row['instances']):
            before=old['instances'][j];assert all(instance[key]==before[key] for key in ['classId','score','box'])
            a=scope['mask_util'].decode(before['segmentation']);b=scope['mask_util'].decode(instance['segmentation'])
            assert b.shape==(row['image']['height'],row['image']['width']) and np.array_equal(a,b[:a.shape[0],:a.shape[1]])
    original=normalized(original); corrected=normalized(corrected)
    original_ap=evaluate(original); corrected_ap=evaluate(corrected)
    result={'status':'failed','verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'images':64,'annotations':716,'criteria':{'minMaskIoU':.99,'maxAPDropPercentagePoints':.5,'scoreThresholdStrictlyGreaterThan':.5,'bothUnmatchedFail':True},'originalOfficialAP':original_ap,'originalSizeReferenceAP':corrected_ap,'modes':{},'mainWorker':{},'reuse':'四模式及生命周期均复用2026-09-18归档，无新SDK或浏览器推理；核验全部归档hash、64个有序唯一ID、源码、冻结与当前dist摘要。'}
    pairs={};modes={}
    for name in ['wasm-main','wasm-worker','webgpu-main','webgpu-worker']:
        data=read(OLD/(name+'-results.json.gz'));validate_rows(data['results'],lock['cases'])
        backend,mode=name.split('-')
        for row in data['results']:
            assert row['runtime']['actualBackend']==backend and row['runtime']['executionMode']==mode
        rows=normalized(data['results']);modes[name]=rows;ap=evaluate(rows)
        entry={'sdkAP':ap}
        for label,baseline,ap_ref in [('originalOfficial',original,original_ap),('originalSizeReference',corrected,corrected_ap)]:
            agreement=compare(baseline,rows);assert agreement['matched']==423
            pairs[name+'-'+label]=agreement.pop('pairs');drop=(ap_ref['AP']-ap['AP'])*100
            entry[label]={'passed':agreement['passed'] and drop<=.5,'apDropPercentagePoints':drop,'agreement':agreement}
        result['modes'][name]=entry
    for backend in ['wasm','webgpu']:
        agreement=compare(modes[backend+'-main'],modes[backend+'-worker'],.01)
        pairs[backend+'-main-worker']=agreement.pop('pairs');result['mainWorker'][backend]=agreement
    result['originalOfficialStatus']='passed' if all(v['originalOfficial']['passed'] for v in result['modes'].values()) else 'failed'
    result['status']='passed' if all(v['originalSizeReference']['passed'] for v in result['modes'].values()) and all(v['passed'] for v in result['mainWorker'].values()) and browser['status']=='passed' else 'failed'
    assert result['originalOfficialStatus']==read(OLD/'acceptance.json')['status']=='failed'
    write('acceptance.json',result)
    with gzip.open(OUT/'instance-comparisons.json.gz','wt',encoding='utf8') as f:json.dump(pairs,f,separators=(',',':'))
    write('reuse-integrity.json',{'status':'passed','oldIntegritySha256':sha((OLD/'evidence-integrity.json').read_bytes()),'files':checked,'sourceSha256':lock['sourceSha256'],'sdkSha256':lock['sdkSha256'],'workerSha256':lock['workerSha256'],'annotationsSha256':lock['annotationsSha256'],'imagesPerMode':64,'newSDKInferenceRuns':0})
    lines=['# 原图整数尺寸独立参考验收','',f"执行时间：{result['verifiedAt']}；新参考结论 **{result['status']}**；原始官方严格结论 **failed**，旧证据完全保留。",'', '原图输入整数width/height是画布权威。完整Paddle model(inputs)执行一次前向，在同一head_outs分别调用固定源post_process和尺寸修正版。仅CPU最后裁剪/空输出尺寸由int(ori_h/w)改为输入整数；原型、sigmoid、插值、框裁剪、NMS和二值化不变。不是未修改的官方基线。SDK输出不参与生成参考。','', '612经Float32比例恢复为611.9999389648438，int得到611，而原官方插值round得到612。synthetic.json覆盖7种横竖/矩形/单像素尺寸及四边前景；新参考保留已计算的末行/列。完整64图的共同区域逐像素一致，原始参考重跑scores/boxes精确一致；见reference-execution.json。','', '| 模式 | SDK AP% | 原始官方最小IoU / 结论 | 整数尺寸最小IoU / 结论 | 新参考AP下降百分点 |','|---|---:|---|---|---:|']
    for name,v in result['modes'].items():
        a=v['originalOfficial'];b=v['originalSizeReference'];lines.append(f"| {name} | {v['sdkAP']['AP']*100:.6f} | {a['agreement']['minMaskIoU']:.10f} / {a['passed']} | {b['agreement']['minMaskIoU']:.10f} / {b['passed']} | {b['apDropPercentagePoints']:.6f} |")
    lines+=['',f"原始官方AP={original_ap['AP']*100:.6f}%；整数尺寸参考AP={corrected_ap['AP']*100:.6f}%。每种模式均检查全部423个score>0.5实例，完整原图mask IoU≥0.99、AP下降≤0.5个百分点、双方未匹配均失败。未切除边缘、未放宽阈值。",'',result['reuse'],'','main/worker在score>0.01下继续使用原匹配规则复算。原始主线程定时取消失败及补测均保留；此处不新增可中断性承诺。','', '复算（不运行Paddle）：`../web-sdk-PP-Detection/.tmp/phase2/venv/Scripts/python.exe scripts/evaluation/compare_original_size.py`。完整重跑参考：同Python执行`scripts/evaluation/original_size_reference.py`。复算成功退出0，数值不通过退出1，完整性断言失败亦为非0。GT位于相邻Detection忽略目录，其SHA见reuse-integrity.json；未再分发图片。','', '完整函数、实际裁剪补丁及源SHA均归档。最初源AST检查错误地假设下载源不含export_mode而失败；paddle.log保留在.tmp，随后改为完整AST精确比较并断言export_mode关闭，实际完成日志为paddle-rerun.log。下载固定路径内容本身含export_mode，不据此假称整个本地源码树未修改。','', '范围仅固定64张COCO val2017、此次Windows桌面Chromium/WASM/WebGPU档案；不代表完整COCO、移动端、NPU、远程分发或稳定版本验收。']
    (OUT/'README.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
    print(json.dumps({'status':result['status'],'originalOfficialStatus':result['originalOfficialStatus'],'modes':{n:{'minMaskIoU':v['originalSizeReference']['agreement']['minMaskIoU'],'apDropPercentagePoints':v['originalSizeReference']['apDropPercentagePoints']} for n,v in result['modes'].items()}},ensure_ascii=False))
    # 可显式重演原始官方严格失败，摘要仍双列保留。
    selected=result['originalOfficialStatus'] if '--original-official' in sys.argv else result['status']
    return 0 if selected=='passed' else 1

if __name__=='__main__':sys.exit(run())
