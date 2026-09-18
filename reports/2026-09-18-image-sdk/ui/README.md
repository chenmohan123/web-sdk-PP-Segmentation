# Demo 浏览器验收

`summary.json` 由 `node tests/browser.mjs` 通过实际交互生成。使用测试图片 COCO val2017 `000000010977.jpg`，来源、文件摘要和 CC BY-NC 2.0 许可见上级 `dataset.lock.json` 的第一项。该图仅用于本地验证，不作为生产 Demo 样例素材。

同目录截图留在本地并由 `.gitignore` 排除，不包含在 Git/npm 中。测试涵盖四种执行组合、画布和实例选择布局、中英与窄屏、取消换图、缓存、Vanilla 示例、生产来源禁用；具体通过项以 summary.json 为准。
