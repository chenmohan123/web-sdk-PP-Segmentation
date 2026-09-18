"""原图参考的失败门槛回归：缺图、重复ID、两侧未匹配和边缘差异不可被隐藏。"""
import copy, sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts/evaluation'))
from compare_original_size import validate_rows, helpers
import numpy as np

class OriginalSizeRegression(unittest.TestCase):
    def setUp(self):
        self.cases=[{'imageId':i,'width':4,'height':3} for i in range(64)]
        self.rows=[{'imageId':i,'image':{'width':4,'height':3},'instances':[]} for i in range(64)]
        self.scope=helpers()
    def test_missing_image_rejected(self):
        with self.assertRaises(AssertionError):validate_rows(self.rows[:-1],self.cases)
    def test_duplicate_image_rejected(self):
        self.rows[-1]['imageId']=0
        with self.assertRaises(AssertionError):validate_rows(self.rows,self.cases)
    def row(self,mask):
        encoded=self.scope['mask_util'].encode(np.asfortranarray(mask));encoded['counts']=encoded['counts'].decode()
        return [{'imageId':1,'instances':[{'classId':0,'score':.8,'box':{'x':0,'y':0,'width':4,'height':3},'segmentation':encoded}]}]
    def test_both_sides_unmatched_fail(self):
        full=self.row(np.ones((3,4),np.uint8));empty=copy.deepcopy(full);empty[0]['instances']=[]
        for a,b in [(full,empty),(empty,full)]:self.assertFalse(self.scope['compare'](a,b)['passed'])
    def test_four_edges_are_evaluated(self):
        full=np.ones((3,4),np.uint8)
        for axis,index in [(0,0),(0,-1),(1,0),(1,-1)]:
            cut=full.copy()
            if axis==0:cut[index,:]=0
            else:cut[:,index]=0
            outcome=self.scope['compare'](self.row(full),self.row(cut))
            self.assertFalse(outcome['passed']);self.assertLess(outcome['minMaskIoU'],.99)

if __name__=='__main__':unittest.main()
