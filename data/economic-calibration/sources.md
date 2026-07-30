# 来源注册表与可引用性说明

**采集日：** 2026-07-30。所有链接在采集日公开可访问；“免费”不等于无条件再分发，应用仍需遵守原站的署名、条款和更新说明。现实序列只作为范围/定义锚点，本包不将它们映射至虚构国家。

## 来源注册表

| ID | 来源、发布者与链接 | 发布/版本；覆盖期；频率 | 使用字段与定义 | 访问/许可 | 可信度与替代来源 |
|---|---|---|---|---|---|
| `SRC-WDI-2026` | [World Development Indicators user guide](https://datatopics.worldbank.org/world-development-indicators/user-guide.html)，世界银行 | WDI 2026 年 7 月更新；约 1,600 指标、近 220 经济体，许多序列逾 50 年；依指标年/季/月 | GDP、人口、部门增加值、贸易、储备、贫困、基础设施等现实参考；逐指标元数据必须随 API/CSV 一同存档 | 公开下载/API；遵守 [World Bank data terms](https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets) | `high` 定义和覆盖；跨国可比性有限（见 `SRC-WDI-METHOD`）。替代：UN Data、国家统计机构 |
| `SRC-WDI-METHOD` | [WDI Sources and Methods](https://datatopics.worldbank.org/world-development-indicators/sources-and-methods.html)，世界银行 | 在线方法说明；持续更新 | 说明跨国口径、滞后、覆盖与可靠性风险 | 公开 | `high` 方法警示；所有 WDI 锚点随版本重取 |
| `SRC-IMF-WEO-2026` | [WEO DataMapper（2026 年 4 月）](https://www.imf.org/external/datamapper/datasets/WEO)，IMF | 发布 2026-04；1980–2031；年度 | 实际 GDP 增长、CPI 通胀、人口、失业、经常账户/GDP、政府债务/GDP | 公开浏览/下载；遵守 IMF 使用条款 | `high` 宏观定义；现实尾端有估计/预测。替代：WDI、国家统计机构 |
| `SRC-IMF-FM-2026` | [Fiscal Monitor DataMapper（2026 年 4 月）](https://www.imf.org/external/datamapper/datasets/FM)，IMF | 发布 2026-04；1990–2031；年度 | 收入、支出、净借贷、债务/GDP；多依 GFSM 2014 | 公开浏览/下载；遵守 IMF 使用条款 | `high` 财政口径；部分为 IMF 工作人员估计。替代：IMF GFS、财政部 |
| `SRC-IMF-DEBT-2010` | [Debt Dynamics 技术手册](https://www.imf.org/-/media/websites/imf/imported-full-text-pdf/external/pubs/ft/tnm/2010/_tnm1002.pdf)，IMF | 2010；非数据集；年度/期别公式 | 债务递推、利息–增长差、主余额 | 公开 PDF | `high` 公式；不含资产负债表外、估值变化或货币化时须扩展 |
| `SRC-IMF-FX-2007` | [WEO 2007 Ch.3: Exchange Rates and External Imbalances](https://www.elibrary.imf.org/abstract/book/9781589066267/ch03.xml)，IMF | 2007；研究/公式 | 汇率传导、J 曲线、Marshall–Lerner 条件 | 可公开读取摘要/章节页 | `high` 机制来源；传导不完全时传统 M–L 需修正 |
| `SRC-IMF-FX-2015` | [WEO 2015 Ch.3](https://www.elibrary.imf.org/display/book/9781513520735/ch003.xml)，IMF | 2015；研究/公式 | 不完全传导下的 M–L 表达 | 可公开读取章节页 | `high` 用于边界条件；替代：`SRC-IMF-FX-2007` |
| `SRC-ILO-LFS` | [ILOSTAT Labour Force Statistics definitions](https://ilostat.ilo.org/methods/concepts-and-definitions/description-labour-force-statistics/)，ILO | 在线；依国家；年度/季/月 | 失业率＝失业者/劳动力；劳动年龄与调查方法要另存 | 公开 | `high` 定义；模型估计和国家报告不可混为同一观测。替代：国家劳调 |
| `SRC-ILO-YOUTH` | [ILOSTAT Youth Labour Market Statistics](https://ilostat.ilo.org/methods/concepts-and-definitions/description-youth-labour-market-statistics/)，ILO | 在线；依国家；通常年度/季 | 青年失业、NEET 与 15–29 的 YouthSTATS 范围 | 公开 | `high` 定义；青年年龄可能与 15–24 指标不同 |
| `SRC-ILO-SOCIAL` | [ILOSTAT SDG labour indicators](https://ilostat.ilo.org/methods/concepts-and-definitions/description-sustainable-development-labour-market-indicators/)，ILO | 在线；依指标 | 社会保障覆盖、实际工资、青年劳动指标 | 公开 | `medium` 跨国调查/模型差异。替代：UN SDG Global Database |
| `SRC-FAO-2026` | [FAOSTAT](https://www.fao.org/faostat/en/#data)，FAO | 持续更新；1961–最近可得年；主要年度 | 粮食平衡、产量、贸易、土地、农业投入 | 公开/API；遵守 FAO 条款 | `high` 农业定义；最新年有滞后。替代：国家农业统计 |
| `SRC-IEA-BAL-2026` | [World Energy Balances](https://www.iea.org/data-and-statistics/data-product/world-energy-balances)，IEA | 2026-07；完整/亮点覆盖不同；年度 | 能源平衡、发电结构、进口依赖、强度 | **只可用标为 Free/Highlights 的下载**；不抓取付费表 | `medium`（免费亮点较稀疏）。替代：Energy Institute Statistical Review、OWID |
| `SRC-IEA-FREE-2026` | [IEA free datasets](https://www.iea.org/data-and-statistics/data-sets?filter=free)，IEA | 页面于 2026-07 可用；依集而定 | 关键矿产、电力、能源终端等免费数据集发现入口 | 公开；许可证逐集检查 | `high` 可用性目录；不代表全部 IEA 数据免费 |
| `SRC-BIS-EER-2026` | [BIS effective exchange rates](https://data.bis.org/topics/EER)，BIS | 最新页显示 2026-07；广义 64 经济体自 1994；月/日 | NEER、REER、贸易权重和汇率压力代理 | 公开下载；BIS 归属 | `high` 汇率指数与定义；权重是制造贸易、按期变动 |
| `SRC-BIS-DSR-2026` | [BIS debt service ratios](https://data.bis.org/topics/DSR)，BIS | 最新页显示 2026-06；最早 1999；季 | 私营部门偿债率、信用缺口、金融压力代理 | 公开下载 | `medium` 水平跨国不可精确比较；更适合本国时间变化 |
| `SRC-UNCT-2026` | [UN Comtrade trade data](https://comtradeplus.un.org/TradeFlow)，UN Statistics Division | 持续更新；年度/月度，视报告国 | 双边商品贸易、HS/SITC/BEC、货运方式与可得性 | 公开；免费注册后最多 100k 记录/次、500 API 调用/日；不需要付费 API | `high` 报关贸易；无固定所有报告国发布时间。替代：WITS、国家海关 |
| `SRC-WB-WITS` | [WITS API User Guide](https://wits.worldbank.org/data/public/WITSAPI_UserGuide.pdf)，世界银行 | v1.4.1；依数据源；年/期 | 贸易、关税和发展指标的元数据、周期和估值 | 公开 API 文档；限额/条款需运行时检查 | `medium` 元数据和补源；原始双边货物流优先 Comtrade |
| `SRC-WB-PINK-2026` | [World Bank commodity prices / Pink Sheet](https://www.worldbank.org/en/research/commodity-markets)，世界银行 | 月度 XLS 至 2026-07；历史月/年表 1960–最近；月/年 | 能源、粮食、金属原始基准价/指数；美元计价、月均 | 公开 XLS；遵守世界银行数据条款 | `high` 商品价格锚点。替代：IMF PCPS/FRED；每月重取 |
| `SRC-WB-GEM-2026` | [Global Economic Monitor catalog](https://datacatalog.worldbank.org/infrastructure-data/search/dataset/0037798/global-economic-monitor)，世界银行 | 目录元数据 2026-05；月/季/年 | CPI、汇率、外储、GDP、工业、贸易、失业等高频现实代理 | 公开目录；系列可得性依国别 | `medium` 高频补充；优先国家官方数据 |
| `SRC-WB-PIP-2026` | [Poverty and Inequality Platform](https://pip.worldbank.org/)，世界银行；可复核镜像：[OWID Gini](https://ourworldindata.org/grapher/economic-inequality-gini-index) | PIP 2026；约 1963–2025；调查年 | 贫困、基尼；收入或消费，税后/福利口径不完全统一 | PIP 公开；OWID CC BY 处理层 | `medium` 只能作范围/定义；调查年和福利口径必须带出 |
| `SRC-OECD-MULTIPLIER` | [Fiscal Multipliers and Prospects for Consolidation](https://www.oecd.org/content/dam/oecd/en/publications/reports/2013/01/oecd-journal-economic-studies-volume-2012-issue-1_g1g16884/eco_studies-v2012-1-en.pdf)，OECD | 2012；论文/模型 | 财政乘数随货币政策、开放度、闲置、债务状态变化 | 公开 PDF | `medium` 参数范围证据；不可外推为单一常数 |
| `SRC-OWID-GINI-2026` | [OWID Gini Explorer](https://ourworldindata.org/grapher/economic-inequality-gini-index)，OWID/World Bank PIP | 2026-06 更新；1963–2025；调查年 | 0–1 基尼展示与 PIP 口径说明 | CC BY 的处理数据；原始 PIP 需另遵守 | `medium` 便利交叉核验；以 PIP 为原始权威 |
| `SRC-FRED-IMF-PCPS` | [FRED data access](https://fred.stlouisfed.org/docs/api/fred/)，St. Louis Fed | 持续更新；依序列；日/月/季 | IMF PCPS 转发的商品、利率与宏观高频备份 | 免费 API key；序列权利与来源逐项核验 | `medium` 便利镜像；优先原始发布者 |
| `SRC-CORE-2026` | [CORE Econ: The Economy](https://www.core-econ.org/the-economy/)，CORE Econ | 在线开放教材；持续版本 | 供需、市场失灵、劳动力、博弈、宏观教学公式与图形 | 开放教材；页内许可为准 | `high` 教学机制；并非每个参数的实证来源 |
| `SRC-NBER-OLS` | [Mastering ’Metrics](https://www.mostlyharmlesseconometrics.com/)，Angrist & Pischke 配套公开材料 | 持续可访问；教学资料 | OLS、固定效应、DiD、IV、RDD、Logit 的识别直觉与局限 | 公开配套资料；教材版权另行遵守 | `high` 计量识别框架；示例数据在本包为合成教学数据 |
| `SRC-FAO-FFPI-2022` | [FAO Food Price Index, March 2022](https://www.fao.org/newsroom/detail/fao-food-price-index-posts-significant-leap-in-march/en)，FAO | 发布 2022-04-08；2022-03 月度值 | FFPI 159.3；较 2 月升 12.6%；谷物、油脂传导案例 | 公开 | `high` 对该事件数值；仅为全球商品价指数，不能推出国别福利 |
| `SRC-FDIC-SVB-2023` | [FDIC SVB resolution release](https://www.fdic.gov/news/press-releases/2023/pr23019.html)，FDIC | 发布 2023-03-13；事件 2023-03-10–13 | 银行关闭、接管、桥接银行、存款人保护的官方时间线 | 公开 | `high` 事件事实；不提供一般化挤兑参数 |
| `SRC-WTO-TM-2018` | [WTO World Trade Statistical Review 2018, trade monitoring](https://www.wto.org/english/res_e/statis_e/wts2018_e/wts2018chapter06_e.pdf)，WTO | 发布 2018-07-10；观察期 2017-10 中旬至 2018-05 中旬 | 新贸易限制措施数量及政策分类 | 公开 PDF | `high` 措施计数；不能等同贸易量或福利因果效应 |

## 校准证据组合与弃用策略

| ID | 类型 | 输入来源 | 转换 | 不确定性与替代 |
|---|---|---|---|---|
| `CAL-SYN-01` | `synthetic_calibration` | `SRC-WDI-2026`、`SRC-IMF-WEO-2026`、`SRC-IMF-FM-2026`、`SRC-ILO-LFS`、`SRC-FAO-2026`、`SRC-IEA-BAL-2026`、`SRC-BIS-EER-2026`、`SRC-UNCT-2026`、`SRC-WB-PIP-2026` | 不映射国家；按可解释发展路径选在公开跨国数量级内的值，再执行 README 的五项一致性约束；指数以世界均值 100 标准化 | `medium`；用滚动分位数更新范围。任何现实国别贴标签会使此校准失效 |
| `CAL-MKT-01` | `synthetic_calibration` | `SRC-WB-PINK-2026`、`SRC-FAO-2026`、`SRC-IEA-FREE-2026`、`SRC-UNCT-2026` | 现实原始价格只作为锚点；市场初值均转为 `index_2026Q1_100=100`，并用弹性/库存范围生成 | `medium`；每月以 Pink Sheet 更新外部锚点，不静默改历史模拟 |
| `CAL-POL-01` | `synthetic_calibration` | `SRC-OECD-MULTIPLIER`、`SRC-IMF-FX-2007`、`SRC-IMF-DEBT-2010`、`SRC-CORE-2026` | 文献范围映射为政策生命周期的最小/中心/最大系数，按开放度、闲置、信誉、金融脆弱性缩放 | `low-to-medium`；需要本世界回放/玩家数据再估计 |
| `CAL-STAB-01` | `synthetic_calibration` | `SRC-ILO-LFS`、`SRC-WB-PIP-2026`、`SRC-IMF-WEO-2026`、`SRC-BIS-DSR-2026` | 多维风险分数、滞后和概率上限；不声称存在真实世界“崩溃阈值” | `low`；只用于可解释玩法与回归测试 |

### 弃用与替换

- 新版本须保留本表的 ID；失效链接不覆盖历史记录，而将 `deprecated_at` 写入 `package_metadata.json` 并添加替代 ID。
- 若来源改写历史序列，保存其下载日和版本；不得回填既有情境的结算结果。
- 任何付费墙、需商业 API 或无法复核的博客/截图均不进入注册表。
