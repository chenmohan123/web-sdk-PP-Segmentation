// 独立全图实验参考；保留160→640→原图的全部像素与Float32插值量化。
// 来源：门户reports/segmentation/2026-09-18-feasibility/reproduction/postprocess.mjs。
export function select([boxes,scores],scoreThreshold=.01,maxDetections=100) {
  const all=[];
  const area=box=>Math.max(0,box[2]-box[0])*Math.max(0,box[3]-box[1]);
  const iou=(a,b)=>{const intersection=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));return intersection/Math.max(1e-12,area(a)+area(b)-intersection);};
  for(let classId=0;classId<80;classId++) {
    let candidates=[];
    for(let index=0;index<8400;index++){const score=scores[classId*8400+index];if(score>scoreThreshold)candidates.push({classId,index,score,box640:Array.from(boxes.subarray(index*4,index*4+4))});}
    candidates.sort((a,b)=>b.score-a.score);candidates=candidates.slice(0,1000);
    while(candidates.length){const first=candidates.shift();all.push(first);candidates=candidates.filter(row=>iou(row.box640,first.box640)<=.7);}
  }
  return all.sort((a,b)=>b.score-a.score).slice(0,maxDetections);
}
function resize(input,sw,sh,width,height) {
  const out=new Float32Array(width*height);
  for(let y=0;y<height;y++) {
    const sy=Math.max(0,Math.min(sh-1,(y+.5)*sh/height-.5)),y0=Math.floor(sy),y1=Math.min(y0+1,sh-1),fy=sy-y0;
    for(let x=0;x<width;x++) {
      const sx=Math.max(0,Math.min(sw-1,(x+.5)*sw/width-.5)),x0=Math.floor(sx),x1=Math.min(x0+1,sw-1),fx=sx-x0;
      const top=input[y0*sw+x0]*(1-fx)+input[y0*sw+x1]*fx,bottom=input[y1*sw+x0]*(1-fx)+input[y1*sw+x1]*fx;
      out[y*width+x]=top*(1-fy)+bottom*fy;
    }
  }
  return out;
}
export function reference(values,width,height,scoreThreshold=.01) {
  return select(values,scoreThreshold).map(row=>{
    const probability=new Float32Array(25600);
    for(let p=0;p<25600;p++){let sum=0;for(let c=0;c<32;c++)sum+=values[2][c*8400+row.index]*values[3][c*25600+p];probability[p]=1/(1+Math.exp(-Math.max(-80,Math.min(80,sum))));}
    const crop=resize(probability,160,160,640,640),[x1,y1,x2,y2]=row.box640;
    for(let y=0;y<640;y++)for(let x=0;x<640;x++)if(x<x1||x>=x2||y<y1||y>=y2)crop[y*640+x]=0;
    return {...row,mask:Uint8Array.from(resize(crop,640,640,width,height),value=>value>.5?1:0)};
  });
}
