# Customizing Text → Image Letters

> **当前仓库状态（先看这里）**：本仓库已不是通用模板，而是 Aizawa 个人主页。标题为 `Aizawa`，6 个字符位各挂**一张**照片（`assets/0?*.jpg`），悬停时换成 `config.js` 里 `labels` 对应的单词。模板原有的 22 张布艺示例素材、以及 README 里描述的「每个位置两张素材」约定都已不适用。改任何行为前请先读 README.md 了解现状。
>
> 下面的规则来自上游模板，仅在需要重新生成字母素材时参考。

This is a general-purpose text-to-image hero, not a textile-only template.

When asked to customize the title or generate assets:

1. Read README.md and docs/MATERIALS.md. Follow the user's latest creative direction.
2. Generate two distinct assets per non-space character position, including independent designs for repeated letters. Use the available image-generation tool; do not pretend that changing a filename creates an image.
3. Default to genuinely varied visual languages and imaginative subjects. Existing textile assets are examples only. Keep characters readable and export complete transparent silhouettes with safe margins.
4. Update config.js, page metadata, and docs/materials.json to match actual new assets. Preserve hover, random variants, subtle spacing expansion, and elastic exit behavior.
5. Compress assets and run the documented checks. Inspect the result at display size when preview tools are available.
6. Keep the template free of embedded API keys. Image generation happens during authoring, not in the browser runtime.

Do not publish new changes unless the user has authorized publication.
