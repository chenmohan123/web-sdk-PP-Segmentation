# 排障

[English](../en/troubleshooting.md) · [返回 README](../../README.md)

先记录 `error.code`、模型 `id/version/sha256`、请求/实际后端、执行模式、浏览器版本及失败 URL；不要把用户图片或完整像素数据默认写入日志。完整错误契约见 [API](api.md)。

| 错误或现象               | 检查与处理                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_INPUT`          | 检查 Blob 是否可解码，RGBA 长度是否为宽×高×4、总像素是否 ≤16,777,216；阈值需在 [0,1]，实例上限为整数 1～300；资源目录 URL 需以 `/` 结尾                  |
| `INVALID_MANIFEST`       | 检查非空身份/版本、绝对 HTTP(S) URL、正整数字节数和 64 位 SHA-256；自定义 ONNX 还必须满足当前 PP-YOLOE_seg 输入/四输出契约                               |
| `DOWNLOAD`               | 在 Network 检查 HTTP 状态、CORS、重定向、连接和 CSP `connect-src`；本地开发确认 `.tmp/model.onnx` 存在，远程来源以 `models/model.json` 为准              |
| `INTEGRITY`              | 确认 URL 返回原始 ONNX，非 HTML 或 LFS pointer；以模型元数据核对完整字节数/摘要。清当前模型缓存后重试，不通过修改摘要跳过校验                            |
| `UNSUPPORTED`            | 检查 HTTPS/安全上下文、Web Crypto、WebAssembly、模块 Worker、图片解码能力；WebGPU 需要真实适配器，可由用户明确改用 WASM/main 等已有模式                  |
| `OUT_OF_MEMORY`          | 缩小原图、降低 `maxDetections`、提高 `scoreThreshold`，释放不用的会话；降低分数阈值会增加候选与掩码，可能加重内存问题。64 MiB 返回上限不等于进程内存上限 |
| `SESSION`                | 检查完整 `dist/` 是否部署、ORT 版本是否一致、Worker/`.mjs/.wasm` 是否返回正确 MIME 而非 HTML，以及 CSP 是否允许加载/编译                                 |
| `INFERENCE`              | 检查模型是否匹配固定输出形状、类型和有限值，记录设备/运行时错误；不要静默换模型、后端或忽略异常                                                          |
| `NOT_LOADED`             | 先 `await sdk.load()`；加载失败后修复原因再加载                                                                                                          |
| `BUSY`                   | 同实例已有 `load/run`；等待它完成，或管理独立实例的资源，不重叠调用                                                                                      |
| `ABORTED`                | 确认是否用户取消；等待操作结束。取消 load 后重新 load，取消 run 后可复用已加载实例；取消不保证立即中断内核                                               |
| `DISPOSED`               | 创建新实例；dispose 后不可复用                                                                                                                           |
| 页面按钮不可运行         | 先选择有效图片；确认所选来源在模型清单中完整可用。正式构建仅使用固定 Hub 来源，开发服务使用显式本地模型。                                                |
| Worker 文件 404/跨源失败 | 完整部署 `dist/`，首选同源 `/sdk/`；使用完整 `runtimeBaseUrl`，例如 `new URL('/sdk/', location.origin).href`；跨源部署需额外模块 CORS/CSP 验证           |
| 相同图再次运行仍慢       | Demo 每次新建和释放会话；模型缓存命中仍需校验及建会话。复用会话的基准与 Demo 延迟不能直接比较                                                            |
| GPU 推理快但页面仍卡     | 主线程模式的预处理/掩码后处理在 CPU；可使用 Worker 改善响应，但不保证计算加速                                                                            |
| 掩码位置偏移或边缘缺失   | 使用 `mask.x/y` 和 `mask.width/height`；不要用 box 坐标代替 ROI，也不要再次按框裁剪；空 mask 的宽高为 0                                                  |
| 旧报告显示验收 failed    | 旧官方参考会截断末行/末列；当前原图整数尺寸参考已通过。核对报告路径与参考口径，见[兼容性](compatibility.md)                                              |

清理缓存示例（此处 `sdk` 是应用已经创建的实例）：

```js
import { clearCurrentModelCache, getModelCacheInfo } from "/sdk/index.js";

await clearCurrentModelCache(sdk.manifest);
console.log(await getModelCacheInfo(sdk.manifest));
```

清理持久缓存不会卸载现有会话；需要强制重新下载时，先释放旧实例，清理缓存，再新建实例加载。更多部署细节见[隐私与部署](privacy-deployment.md)。
