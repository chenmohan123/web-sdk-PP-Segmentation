"""原图整数尺寸参考：完整Paddle前向，仅替换官方最后裁剪尺寸；不读取SDK掩码。"""
import os
os.environ['OMP_NUM_THREADS'] = '4'
import argparse, ast, datetime, difflib, gzip, hashlib, json, sys, textwrap, types
from pathlib import Path
import numpy as np
from pycocotools import mask as mask_util

ROOT = Path(__file__).resolve().parents[2]
OLD = ROOT/'reports/2026-09-18-image-sdk'
OUT = ROOT/'reports/2026-09-18-original-size'
UPSTREAM = ROOT.parent/'web-sdk-PP-Detection/.tmp/phase2/upstream/PaddleDetection-b25522a0f4bde8c80603f3ba5e3472059972e3b5'
ARCHIVE = ROOT.parent/'chenmohan123.github.io/reports/segmentation/2026-09-18-feasibility/upstream/ppdet/modeling/heads/ppyoloe_ins_head.py.gz'
WEIGHTS = ROOT.parent/'chenmohan123.github.io/.tmp/segmentation-20260918/ppyoloe_seg_s_80e_coco.pdparams'
def sha(data): return hashlib.sha256(data).hexdigest()
def read(path):
    if str(path).endswith('.gz'):
        with gzip.open(path,'rt',encoding='utf8') as f: return json.load(f)
    return json.loads(path.read_text(encoding='utf8'))
def write(name,data): (OUT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def function(source):
    tree=ast.parse(source)
    cls=next(n for n in tree.body if isinstance(n,ast.ClassDef) and any(isinstance(x,ast.FunctionDef) and x.name=='post_process' for x in n.body))
    return next(n for n in cls.body if isinstance(n,ast.FunctionDef) and n.name=='post_process')

def run():
    import paddle
    sys.path.insert(0,str(UPSTREAM))
    from ppdet.core.workspace import create,load_config
    import ppdet.modeling.heads.ppyoloe_ins_head as module
    paddle.set_device('cpu')
    original_bytes=(OUT/'upstream-head.py').read_bytes()
    original=function(original_bytes.decode('utf8'))
    archived=function(gzip.decompress(ARCHIVE.read_bytes()).decode('utf8'))
    assert isinstance(archived.body[0],ast.If) and 'export_mode' in ast.unparse(archived.body[0])
    assert ast.dump(original,include_attributes=False)==ast.dump(archived,include_attributes=False), '归档原函数与固定上游不同'
    original_source=ast.unparse(original)+'\n'
    patched=ast.parse(original_source)
    class CropOnly(ast.NodeTransformer):
        count=0
        def visit_Call(self,node):
            if isinstance(node.func,ast.Name) and node.func.id=='int' and len(node.args)==1 and isinstance(node.args[0],ast.Name) and node.args[0].id in ('ori_h','ori_w'):
                self.count+=1
                return ast.copy_location(ast.parse('self._original_size[%d]' % (0 if node.args[0].id=='ori_h' else 1),mode='eval').body,node)
            return self.generic_visit(node)
    transform=CropOnly(); patched=ast.fix_missing_locations(transform.visit(patched)); assert transform.count==4
    patched_source=ast.unparse(patched)+'\n'
    (OUT/'post-process-original.py').write_text(original_source,encoding='utf8')
    (OUT/'post-process-original-size.py').write_text(patched_source,encoding='utf8')
    (OUT/'crop-only.patch').write_text(''.join(difflib.unified_diff(original_source.splitlines(True),patched_source.splitlines(True),fromfile='post-process-original.py',tofile='post-process-original-size.py')),encoding='utf8')
    scope=dict(vars(module)); exec(compile(original_source,'post-process-original.py','exec'),scope); original_fn=scope['post_process']
    exec(compile(patched,'post-process-original-size.py','exec'),scope); corrected_fn=scope['post_process']
    # 使用官方原型乘法、sigmoid、第一次插值和框裁剪；四边均保留前景。
    synthetic=[]
    for h,w in [(612,640),(640,612),(612,612),(375,500),(427,640),(321,517),(1,1)]:
        sf=paddle.to_tensor([[640/h,640/w]],dtype='float32'); floating=(paddle.to_tensor([[640.,640.]])/sf).numpy()[0]
        proto=paddle.full([1,160,160],8.); coeff=paddle.ones([1,1]); box=paddle.to_tensor([[0.,0.,640.,640.]])
        logits=module.process_mask_upsample(proto,coeff,box,[640,640])
        size=[int(paddle.round(640/sf[0][0])),int(paddle.round(640/sf[0][1]))]
        scaled=module.F.interpolate(logits.unsqueeze(0),size=size,mode='bilinear',align_corners=False).numpy()[0,0]
        fixed=scaled[:h,:w]>.5; old=scaled[:int(floating[0]),:int(floating[1])]>.5
        assert list(fixed.shape)==[h,w] and fixed.all() and np.array_equal(old,fixed[:old.shape[0],:old.shape[1]])
        synthetic.append({'height':h,'width':w,'float32Recovered':floating.tolist(),'originalShape':list(old.shape),'correctedShape':list(fixed.shape),'fourEdgesForeground':[int(fixed[0].sum()),int(fixed[-1].sum()),int(fixed[:,0].sum()),int(fixed[:,-1].sum())],'commonDifferentPixels':0})
    write('synthetic.json',{'status':'passed','cases':synthetic})
    cfg=load_config(str(UPSTREAM/'configs/ppyoloe_seg/ppyoloe_seg_s_80e_coco.yml')); model=create(cfg.architecture)
    missing,unexpected=model.set_state_dict(paddle.load(str(WEIGHTS))); assert not missing and not unexpected
    model.eval(); model.yolo_head.nms.keep_top_k=100
    assert model.yolo_head.nms.score_threshold==.01 and model.yolo_head.nms.nms_threshold==.7
    assert not getattr(model.yolo_head,'export_mode',False)
    lock=read(OLD/'dataset.lock.json'); previous=read(OLD/'paddle-results.json.gz')
    assert [r['imageId'] for r in previous]==[r['imageId'] for r in lock['cases']]
    results=[]; invariants=[]
    def both(self,*args,**kwargs):
        self._original_result=original_fn(self,*args,**kwargs)
        corrected=corrected_fn(self,*args,**kwargs)
        # 两次后处理共享同一次完整模型前向，不修改head_outs。
        assert np.array_equal(self._original_result[0].numpy(),corrected[0].numpy())
        return corrected
    model.yolo_head.post_process=types.MethodType(both,model.yolo_head)
    for index,case in enumerate(lock['cases']):
        binary=(ROOT/'.tmp/acceptance-20260918/inputs'/f"{case['imageId']}.f32").read_bytes(); assert sha(binary)==case['tensorSha256']
        tensor=np.frombuffer(binary,dtype=np.float32).reshape(1,3,640,640)
        model.yolo_head._original_size=(case['height'],case['width'])
        inputs={'image':paddle.to_tensor(tensor),'im_shape':paddle.to_tensor([[640.,640.]]),'scale_factor':paddle.to_tensor([[640/case['height'],640/case['width']]],dtype='float32')}
        with paddle.no_grad(): result=model(inputs)
        boxes=result['bbox'].numpy(); masks=result['mask'].numpy().astype(np.uint8)
        original_masks=model.yolo_head._original_result[2].numpy().astype(np.uint8)
        instances=[]; changed=0; old_rows=previous[index]['instances']; score_delta=0.; box_delta=0.; archive_diff=0
        selected=[i for i,b in enumerate(boxes) if b[1]>.01]; assert len(selected)==len(old_rows)
        for j,i in enumerate(selected):
            box=boxes[i]; mask=masks[i]; before=original_masks[i]; old=old_rows[j]
            assert mask.shape==(case['height'],case['width']) and np.array_equal(mask[:before.shape[0],:before.shape[1]],before)
            assert old['classId']==int(box[0]); archived_mask=mask_util.decode(old['segmentation']); assert archived_mask.shape==before.shape
            archive_diff+=int(np.count_nonzero(archived_mask!=before))
            score_delta=max(score_delta,abs(old['score']-float(box[1])))
            new_box={'x':float(box[2]),'y':float(box[3]),'width':float(box[4]-box[2]),'height':float(box[5]-box[3])}
            box_delta=max(box_delta,max(abs(old['box'][k]-new_box[k]) for k in new_box))
            changed+=int(mask.sum())-int(before.sum())
            rle=mask_util.encode(np.asfortranarray(mask));rle['counts']=rle['counts'].decode('ascii')
            instances.append({'classId':int(box[0]),'score':float(box[1]),'box':new_box,'segmentation':rle})
        invariants.append({'imageId':case['imageId'],'instances':len(instances),'originalShape':list(original_masks.shape[1:]),'correctedShape':list(masks.shape[1:]),'sameForwardBoxesScoresExact':True,'commonDifferentPixels':0,'archiveMaskDifferentPixels':archive_diff,'archiveMaxScoreDelta':score_delta,'archiveMaxBoxDelta':box_delta,'restoredForegroundPixels':changed})
        assert archive_diff==0 and score_delta==0 and box_delta==0, '历史官方输出重算不一致'
        results.append({'imageId':case['imageId'],'image':{'height':case['height'],'width':case['width']},'instances':instances})
        print(json.dumps(invariants[-1]),flush=True)
    with gzip.open(OUT/'paddle-original-size-results.json.gz','wt',encoding='utf8') as f:json.dump(results,f,separators=(',',':'))
    write('reference-execution.json',{'status':'passed','verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'paddle':paddle.__version__,'device':'cpu','threads':4,'images':len(results),'upstreamRevision':'b25522a0f4bde8c80603f3ba5e3472059972e3b5','upstreamSourceUrl':'https://raw.githubusercontent.com/PaddlePaddle/PaddleDetection/b25522a0f4bde8c80603f3ba5e3472059972e3b5/ppdet/modeling/heads/ppyoloe_ins_head.py','upstreamHeadSha256':sha(original_bytes),'archivedHeadSha256':sha(gzip.decompress(ARCHIVE.read_bytes())),'importedHeadSha256':sha(Path(module.__file__).read_bytes()),'weightsSha256':sha(WEIGHTS.read_bytes()),'originalFunctionSha256':sha(original_source.encode()),'correctedFunctionSha256':sha(patched_source.encode()),'astChanges':transform.count,'method':'完整model(inputs)，在同一head_outs上分别执行固定源原函数与仅改CPU最终尺寸的函数；下载文件与归档post_process AST严格相等；export_mode断言关闭。4处int替换：正常分支h/w和空检测分支h/w。NPU分支未修改、未验证。','cases':invariants})

    files=[]
    for name in ['paddle-original-size-results.json.gz','reference-execution.json','synthetic.json','upstream-head.py','post-process-original.py','post-process-original-size.py','crop-only.patch']:
        data=(OUT/name).read_bytes();files.append({'name':name,'bytes':len(data),'sha256':sha(data)})
    write('reference-integrity.json',{'status':'passed','files':files})

if __name__=='__main__': run()
