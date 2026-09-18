def post_process(self, head_outs, im_shape, scale_factor, infer_shape=[640, 640], rescale=True):
    if getattr(self, 'export_mode', False):
        return self.export_post_process(head_outs, im_shape, scale_factor, infer_shape, rescale)
    pred_scores, pred_dist, pred_mask_coeffs, mask_feat, anchor_points, stride_tensor = head_outs
    pred_bboxes = batch_distance2bbox(anchor_points, pred_dist)
    pred_bboxes *= stride_tensor
    if self.exclude_post_process:
        return (paddle.concat([pred_bboxes, pred_scores.transpose([0, 2, 1]), pred_mask_coeffs.transpose([0, 2, 1])], axis=-1), mask_feat, None)
    bbox_pred, bbox_num, keep_idxs = self.nms(pred_bboxes, pred_scores)
    if bbox_num.sum() > 0:
        pred_mask_coeffs = pred_mask_coeffs.transpose([0, 2, 1])
        mask_coeffs = paddle.gather(pred_mask_coeffs.reshape([-1, self.num_masks]), keep_idxs)
        mask_logits = process_mask_upsample(mask_feat[0], mask_coeffs, bbox_pred[:, 2:6], infer_shape)
        if rescale:
            ori_h, ori_w = im_shape[0] / scale_factor[0]
            mask_logits = F.interpolate(mask_logits.unsqueeze(0), size=[int(paddle.round(mask_logits.shape[-2] / scale_factor[0][0])), int(paddle.round(mask_logits.shape[-1] / scale_factor[0][1]))], mode='bilinear', align_corners=False)
            if 'npu' in paddle.device.get_all_custom_device_type():
                mask_logits = mask_logits[..., :round(ori_h.item()), :round(ori_w.item())]
            else:
                mask_logits = mask_logits[..., :self._original_size[0], :self._original_size[1]]
        masks = mask_logits.squeeze(0)
        mask_pred = paddle.to_tensor(masks > self.mask_thr_binary).cast('float32')
        scale_factor = scale_factor.flip(-1).tile([1, 2])
        bbox_pred[:, 2:6] /= scale_factor
    else:
        ori_h, ori_w = im_shape[0] / scale_factor[0]
        bbox_num = paddle.to_tensor([1]).cast('int32')
        bbox_pred = paddle.zeros([bbox_num, 6])
        mask_pred = paddle.zeros([bbox_num, self._original_size[0], self._original_size[1]])
    return (bbox_pred, bbox_num, mask_pred, keep_idxs)
